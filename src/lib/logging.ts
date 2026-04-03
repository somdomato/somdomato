import { db } from "../db/index.ts";
import { adminLogs } from "../db/schema.ts";

export type LogAction =
  | "upload:created"
  | "upload:approved"
  | "upload:rejected"
  | "upload:deleted"
  | "upload:ai_approved"
  | "upload:ai_kept"
  | "upload:ai_rejected"
  | "upload:ai_deleted"
  | "song:created"
  | "song:updated"
  | "song:deleted"
  | "request:added"
  | "request:removed"
  | "request:reordered"
  | "admin:skip"
  | "admin:login"
  | "admin:logout"
  | "user:request"
  | "user:upload"
  | "user:created"
  | "user:updated"
  | "user:deleted"
  | "permissions:updated"
  | "role:created"
  | "role:updated"
  | "role:deleted";

interface LogEntry {
  action: LogAction;
  details?: Record<string, unknown>;
  targetType?: "upload" | "song" | "request" | "user" | "role";
  targetId?: number;
  ip?: string;
  userId?: number;
}

export async function logAction(entry: LogEntry): Promise<void> {
  // Auto-capture userId from session if not explicitly provided
  let userId = entry.userId ?? null;
  if (!userId) {
    try {
      const { cookies } = await import("next/headers");
      const { getUserFromSession } = await import("@/lib/session");
      const cookieStore = await cookies();
      const session = getUserFromSession(cookieStore);
      if (session) userId = Number(session.id);
    } catch {
      // May fail outside request context
    }
  }

  try {
    const [inserted] = await db
      .insert(adminLogs)
      .values({
        userId,
        action: entry.action,
        details: entry.details ? JSON.stringify(entry.details) : null,
        targetType: entry.targetType,
        targetId: entry.targetId,
        ip: entry.ip,
      })
      .returning();

    // Emit Socket.io event for real-time updates
    if (global.io && inserted) {
      global.io.emit("log:added", {
        id: inserted.id,
        userId,
        action: inserted.action,
        details: entry.details || null,
        targetType: inserted.targetType,
        targetId: inserted.targetId,
        ip: inserted.ip,
        createdAt: inserted.createdAt,
      });
    }
  } catch (err) {
    console.error("[log] Erro ao salvar log:", err);
  }
}
