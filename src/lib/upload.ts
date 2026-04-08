import { db } from "../db/index.ts";
import { uploads, songs } from "../db/schema.ts";
import { eq, and, isNotNull } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { logAction } from "./logging.ts";

const MUSIC_PATH = process.env.MUSIC_PATH || "/var/music/sdm";

/**
 * Approves an upload: moves file to music dir, extracts cover, inserts into songs table.
 * Returns the created song ID.
 */
export async function approveUpload(
  uploadId: number,
  genre: string,
): Promise<
  { success: true; songId: number } | { success: false; error: string }
> {
  const [upload] = await db
    .select()
    .from(uploads)
    .where(eq(uploads.id, uploadId))
    .limit(1);

  if (!upload) {
    return { success: false, error: "Upload not found" };
  }

  if (!fs.existsSync(upload.path)) {
    return {
      success: false,
      error:
        "Arquivo não encontrado no servidor. O upload pode ter sido removido.",
    };
  }

  const destPath = path.join(MUSIC_PATH, upload.filename);

  if (!fs.existsSync(MUSIC_PATH)) {
    fs.mkdirSync(MUSIC_PATH, { recursive: true });
  }

  fs.copyFileSync(upload.path, destPath);
  fs.unlinkSync(upload.path);

  // Extract and save cover from MP3, existing file, or Deezer API
  let coverPath = "/images/logotipo.svg";
  try {
    const { resolveSongCover } = await import("../lib/cover");
    const resolved = await resolveSongCover({
      mp3Path: destPath,
      artist: upload.artist,
      title: upload.title,
    });
    if (resolved) {
      coverPath = resolved;
    }
  } catch (err) {
    console.error("Erro ao resolver capa:", err);
  }

  // Add to songs table
  const [inserted] = await db
    .insert(songs)
    .values({
      title: upload.title,
      artist: upload.artist,
      path: destPath,
      cover: coverPath,
      genre: genre || "geral",
      rotation: "normal",
      timeSlots: 15,
    })
    .returning({ id: songs.id });

  // Update upload status
  await db
    .update(uploads)
    .set({ status: "approved" })
    .where(eq(uploads.id, uploadId));

  await logAction({
    action: "upload:approved",
    targetType: "upload",
    targetId: uploadId,
    details: {
      title: upload.title,
      artist: upload.artist,
      genre,
      songId: inserted.id,
    },
  });

  return { success: true, songId: inserted.id };
}

// ---------------------------------------------------------------------------
// Auto-approve helpers
// ---------------------------------------------------------------------------

const AUTO_APPROVE_MAX_DURATION = 8 * 60; // 8 minutes in seconds

/** Deezer genre names that count as "sertanejo" */
const SERTANEJO_PATTERNS = [
  "sertanejo",
  "sertaneja",
  "sertanejo universitário",
  "sertanejo universitario",
];

/**
 * Fetch genre names from a Deezer album.
 * Returns an array of genre name strings (e.g. ["Sertanejo"]).
 */
async function fetchDeezerAlbumGenres(albumId: number): Promise<string[]> {
  try {
    const res = await fetch(`https://api.deezer.com/album/${albumId}`);
    const data = await res.json();
    if (data.genres?.data) {
      return data.genres.data.map((g: { name: string }) => g.name);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Check if a Deezer track qualifies for auto-approval.
 * Returns genre string if approved, null if not.
 */
export async function checkAutoApproval(
  trackId: string,
): Promise<
  | { approved: true; genre: string; deezerGenre: string; duration: number }
  | { approved: false; duration: number; deezerGenre: string }
> {
  const res = await fetch(
    `https://api.deezer.com/track/${encodeURIComponent(trackId)}`,
  );
  const track = await res.json();

  const duration: number = track.duration || 0;
  const albumId: number | undefined = track.album?.id;

  // Fetch album genres for more detail
  let genreNames: string[] = [];
  if (albumId) {
    genreNames = await fetchDeezerAlbumGenres(albumId);
  }

  const deezerGenre = genreNames.join(", ") || "Desconhecido";

  const isSertanejo = genreNames.some((name) =>
    SERTANEJO_PATTERNS.some((p) => name.toLowerCase().includes(p)),
  );

  const isShortEnough = duration > 0 && duration <= AUTO_APPROVE_MAX_DURATION;

  if (isSertanejo && isShortEnough) {
    return { approved: true, genre: "geral", deezerGenre, duration };
  }

  return { approved: false, duration, deezerGenre };
}

// ---------------------------------------------------------------------------
// Delayed auto-approve scheduling
// ---------------------------------------------------------------------------

/** In-memory map of pending auto-approve timers (uploadId → timer) */
const pendingTimers = new Map<number, ReturnType<typeof setTimeout>>();

/**
 * Execute auto-approval for a single upload.
 * Checks that the upload is still pending before approving.
 */
async function executeAutoApprove(uploadId: number): Promise<void> {
  pendingTimers.delete(uploadId);

  try {
    const [upload] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, uploadId))
      .limit(1);

    // Only approve if still pending and has autoApproveAt set
    if (!upload || upload.status !== "pending" || !upload.autoApproveAt) {
      return;
    }

    // Move to ai_approved status (admin can then keep/reject/delete)
    await db
      .update(uploads)
      .set({ status: "ai_approved", autoApproved: 1 })
      .where(eq(uploads.id, uploadId));

    await logAction({
      action: "upload:ai_approved",
      targetType: "upload",
      targetId: uploadId,
      details: {
        title: upload.title,
        artist: upload.artist,
        genre: upload.autoApproveGenre,
        reason: upload.aiReason || "Auto-aprovação por critérios automáticos",
      },
    });

    // Emit socket event for real-time update
    if (global.io) {
      global.io.emit("upload:ai_approved", {
        id: uploadId,
        title: upload.title,
        artist: upload.artist,
      });
    }

    console.log(
      `[auto-approve] Upload #${uploadId} "${upload.title}" movido para aprovação IA.`,
    );
  } catch (err) {
    console.error(`[auto-approve] Erro no upload #${uploadId}:`, err);
  }
}

/**
 * Schedule auto-approval after a delay (in ms).
 * The timer is tracked so it can be cancelled if admin rejects/approves manually.
 */
export function scheduleAutoApprove(uploadId: number, delayMs: number): void {
  // Clear any existing timer for this upload
  cancelAutoApprove(uploadId);

  const timer = setTimeout(() => executeAutoApprove(uploadId), delayMs);
  pendingTimers.set(uploadId, timer);

  console.log(
    `[auto-approve] Upload #${uploadId} agendado para ${Math.round(delayMs / 1000)}s.`,
  );
}

/**
 * Cancel a scheduled auto-approval (e.g. admin rejected or manually approved).
 */
export function cancelAutoApprove(uploadId: number): void {
  const timer = pendingTimers.get(uploadId);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(uploadId);
  }
}

/**
 * On server startup, re-schedule any pending auto-approvals from the database.
 * Call this from server.ts after boot.
 */
export async function restorePendingAutoApprovals(): Promise<void> {
  try {
    const pending = await db
      .select()
      .from(uploads)
      .where(
        and(eq(uploads.status, "pending"), isNotNull(uploads.autoApproveAt)),
      );

    const now = Date.now();

    for (const upload of pending) {
      const approveAt = upload.autoApproveAt!.getTime();
      const delayMs = Math.max(approveAt - now, 0);

      scheduleAutoApprove(upload.id, delayMs);
    }

    if (pending.length > 0) {
      console.log(
        `[auto-approve] ${pending.length} aprovação(ões) pendente(s) restaurada(s).`,
      );
    }
  } catch (err) {
    console.error(
      "[auto-approve] Erro ao restaurar aprovações pendentes:",
      err,
    );
  }
}
