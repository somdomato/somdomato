import { NextRequest } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { checkAutoApproval, scheduleAutoApprove } from "@/lib/upload";
import { eq } from "drizzle-orm";
import { AUTO_APPROVE_DELAY_MINUTES } from "@/config";
import { evaluateTrack, enqueue } from "@/lib/ai";
import { logAction } from "@/lib/logging";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/var/music/sdm/uploads";
const MAX_UPLOADS_PER_HOUR = 5;
const MAX_DURATION_SECONDS = 10 * 60; // 10 minutes

// In-memory rate limiting: IP -> timestamps of uploads in the last hour
const uploadsByIp = new Map<string, number[]>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const timestamps = (uploadsByIp.get(ip) || []).filter((t) => t > oneHourAgo);
  uploadsByIp.set(ip, timestamps);
  return timestamps.length >= MAX_UPLOADS_PER_HOUR;
}

function recordUpload(ip: string): void {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const timestamps = (uploadsByIp.get(ip) || []).filter((t) => t > oneHourAgo);
  timestamps.push(now);
  uploadsByIp.set(ip, timestamps);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Resolve symlinks so path comparisons are consistent */
function realpath(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch {
    return dir;
  }
}

/**
 * Recursively collect ALL files under `dir`.
 * Uses fs.statSync (follows symlinks) so symlinked subdirs are traversed.
 * Returns a Map of absolute path → mtime (ms).
 */
function getAllFiles(dir: string): Map<string, number> {
  const results = new Map<string, number>();
  const recurse = (d: string) => {
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        try {
          const stat = fs.statSync(full); // follows symlinks
          if (stat.isDirectory()) {
            recurse(full);
          } else {
            results.set(full, stat.mtimeMs);
          }
        } catch {
          // skip unreadable entries
        }
      }
    } catch {
      // ignore unreadable dirs
    }
  };
  recurse(dir);
  return results;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: object) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const clientIp = getClientIp(request);

        if (isRateLimited(clientIp)) {
          send({
            error: "Limite de envios atingido. Máximo de 5 músicas por hora.",
            done: true,
          });
          return;
        }

        const body = await request.json();
        const { trackId, title, artist, thumbnail } = body;

        if (!trackId || !title || !artist) {
          send({ error: "Missing required fields", done: true });
          return;
        }

        // Check track duration via Deezer API before downloading
        try {
          const trackRes = await fetch(
            `https://api.deezer.com/track/${encodeURIComponent(String(trackId))}`,
          );
          const trackData = await trackRes.json();
          if (trackData.duration && trackData.duration > MAX_DURATION_SECONDS) {
            const mins = Math.floor(trackData.duration / 60);
            const secs = trackData.duration % 60;
            send({
              error: `Música muito longa (${mins}:${String(secs).padStart(2, "0")}). Máximo permitido: 10 minutos.`,
              done: true,
            });
            return;
          }
        } catch (e) {
          console.error("Failed to check track duration:", e);
          // Continue if Deezer API check fails — don't block the download
        }

        ensureDir(UPLOADS_DIR);

        const realUploadsDir = realpath(UPLOADS_DIR);
        const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
        const sanitizedArtist = artist.replace(/[^a-zA-Z0-9\s-]/g, "").trim();

        send({
          status: "starting",
          progress: 0,
          message: "Iniciando download...",
        });

        // const startMs = Date.now();

        // godeez v1.4.0 always writes to ~/Music/GoDeez (ignores cwd)
        const homeDir = process.env.HOME || process.env.USERPROFILE || "/root";
        const godeezDir = path.join(homeDir, "Music", "GoDeez");
        ensureDir(godeezDir);

        // Snapshot godeez output dir before download
        const filesBefore = getAllFiles(godeezDir);

        const godeezProcess = spawn(
          "godeez",
          ["download", "track", String(trackId)],
          {
            cwd: realUploadsDir,
            env: {
              ...process.env,
              DEEZER_ARL: process.env.DEEZER_ARL,
              HOME: homeDir,
            },
          },
        );

        let lastProgress = 5;
        const parseProgress = (output: string) => {
          const match = output.match(/(\d+(?:\.\d+)?)\s*%/);
          if (match) {
            const percent = Math.min(89, Math.round(parseFloat(match[1])));
            if (percent > lastProgress) {
              lastProgress = percent;
              send({
                status: "downloading",
                progress: percent,
                message: `Baixando: ${percent}%`,
              });
            }
          }
        };

        let stderr = "";
        let stdout = "";
        godeezProcess.stdout?.on("data", (chunk: Buffer) => {
          const output = chunk.toString();
          stdout += output;
          parseProgress(output);
        });

        godeezProcess.stderr?.on("data", (chunk: Buffer) => {
          const output = chunk.toString();
          stderr += output;
          parseProgress(output);
        });

        const exitCode = await new Promise<number>((resolve, reject) => {
          godeezProcess.on("close", (code) => resolve(code ?? 0));
          godeezProcess.on("error", reject);
        });

        const combinedOutput = `${stdout} ${stderr}`;
        if (exitCode !== 0 || /error:/i.test(combinedOutput)) {
          console.error(
            `godeez failed (code ${exitCode}). stdout: ${stdout} stderr: ${stderr}`,
          );
          const authFailed = /failed to authenticate|invalid arl/i.test(
            combinedOutput,
          );
          send({
            error: authFailed
              ? "Falha na autenticação Deezer. Verifique o token ARL."
              : `Falha no download (código ${exitCode}). Verifique o token ARL do Deezer.`,
            done: true,
          });
          return;
        }

        send({ status: "processing", progress: 90, message: "Processando..." });

        // Retry file detection with increasing delays to handle slow I/O
        let foundPath: string | null = null;
        const delays = [500, 1500, 3000];

        for (const delay of delays) {
          await new Promise((r) => setTimeout(r, delay));

          // godeez writes to ~/Music/GoDeez/Artist/Album/track.mp3
          const filesAfter = getAllFiles(godeezDir);
          const newFiles = [...filesAfter.keys()].filter(
            (f) => !filesBefore.has(f),
          );

          if (newFiles.length > 0) {
            // Pick the most recently modified audio file
            const audioFiles = newFiles.filter((f) =>
              /\.(mp3|flac|ogg|m4a)$/i.test(f),
            );
            const candidates = audioFiles.length > 0 ? audioFiles : newFiles;
            foundPath = candidates.sort(
              (a, b) => (filesAfter.get(b) ?? 0) - (filesAfter.get(a) ?? 0),
            )[0];
            break;
          }
        }

        if (!foundPath) {
          const filesAfterFinal = getAllFiles(godeezDir);
          console.error(
            `godeez: no new file found after retries.`,
            `\n  godeezDir=${godeezDir}`,
            `\n  UPLOADS_DIR=${UPLOADS_DIR}`,
            `\n  HOME=${homeDir}`,
            `\n  files before (${filesBefore.size}): ${[...filesBefore.keys()].slice(0, 20).join(", ")}`,
            `\n  files after (${filesAfterFinal.size}): ${[...filesAfterFinal.keys()].slice(0, 20).join(", ")}`,
            `\n  stdout: ${stdout}`,
            `\n  stderr: ${stderr}`,
          );
          send({ error: "Arquivo não encontrado após download", done: true });
          return;
        }

        // Move file to UPLOADS_DIR root with standardized filename
        const ext = path.extname(foundPath) || ".mp3";
        const filename = `${sanitizedArtist} - ${sanitizedTitle}${ext}`;
        const outputPath = path.join(realUploadsDir, filename);

        if (foundPath !== outputPath) {
          try {
            fs.renameSync(foundPath, outputPath);
          } catch {
            // renameSync fails across filesystems — copy + delete instead
            fs.copyFileSync(foundPath, outputPath);
            fs.unlinkSync(foundPath);
          }
        }

        // Record this upload for rate limiting
        recordUpload(clientIp);

        // Save to database
        const [uploadRecord] = await db
          .insert(uploads)
          .values({
            title,
            artist,
            deezerUrl: `https://www.deezer.com/track/${trackId}`,
            deezerId: String(trackId),
            thumbnail: thumbnail || null,
            filename,
            path: outputPath,
            status: "pending",
          })
          .returning({ id: uploads.id });

        // Check auto-approval criteria via Deezer metadata + AI
        // Queued sequentially to avoid bursting free-tier API rate limits.
        try {
          const { shouldApprove, approveGenre, aiReason } = await enqueue(
            async () => {
              const check = await checkAutoApproval(String(trackId));

              // Store duration and genre info regardless of approval
              await db
                .update(uploads)
                .set({
                  duration: check.duration || null,
                  deezerGenre: check.deezerGenre || null,
                })
                .where(eq(uploads.id, uploadRecord.id));

              // Run AI evaluation for richer analysis
              let aiResult: {
                approved: boolean;
                reason: string;
                suggestedGenre: string;
              } | null = null;
              try {
                aiResult = await evaluateTrack({
                  title,
                  artist,
                  deezerGenre: check.deezerGenre || "Desconhecido",
                  duration: check.duration || 0,
                });

                // Store AI reason in the upload record
                await db
                  .update(uploads)
                  .set({ aiReason: aiResult.reason })
                  .where(eq(uploads.id, uploadRecord.id));
              } catch (aiErr) {
                console.error("AI evaluation failed:", aiErr);
              }

              return {
                shouldApprove: aiResult?.approved ?? check.approved,
                approveGenre:
                  aiResult?.suggestedGenre ??
                  (check.approved ? check.genre : "geral"),
                aiReason: aiResult?.reason ?? null,
              };
            },
          );

          if (shouldApprove) {
            const delayMs = AUTO_APPROVE_DELAY_MINUTES * 60 * 1000;
            const autoApproveAt = new Date(Date.now() + delayMs);

            await db
              .update(uploads)
              .set({
                autoApproveAt,
                autoApproveGenre: approveGenre,
              })
              .where(eq(uploads.id, uploadRecord.id));

            // Schedule the actual approval after the delay
            scheduleAutoApprove(uploadRecord.id, delayMs);

            await logAction({
              action: "user:upload",
              targetType: "upload",
              targetId: uploadRecord.id,
              details: {
                title,
                artist,
                autoApprove: true,
                aiReason,
              },
              ip: clientIp,
            });

            const delayLabel =
              AUTO_APPROVE_DELAY_MINUTES >= 1
                ? `${AUTO_APPROVE_DELAY_MINUTES}min`
                : `${AUTO_APPROVE_DELAY_MINUTES * 60}s`;

            send({
              status: "complete",
              progress: 100,
              message: `Download concluído! Será aprovada automaticamente em ${delayLabel}.`,
              done: true,
              autoApproveScheduled: true,
            });
            return;
          }
        } catch (e) {
          console.error("Auto-approve check failed:", e);
          // Continue with pending status — admin will review manually
        }

        await logAction({
          action: "user:upload",
          targetType: "upload",
          targetId: uploadRecord.id,
          details: { title, artist, autoApprove: false },
          ip: clientIp,
        });

        send({
          status: "complete",
          progress: 100,
          message: "Download concluído! Aguardando moderação.",
          done: true,
        });
      } catch (error) {
        console.error("Download error:", error);
        send({
          error: error instanceof Error ? error.message : "Download failed",
          done: true,
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
