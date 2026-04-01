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
  | "permissions:updated";

interface LogEntry {
  action: LogAction;
  details?: Record<string, unknown>;
  targetType?: "upload" | "song" | "request" | "user";
  targetId?: number;
  ip?: string;
}

export async function logAction(entry: LogEntry): Promise<void> {
  try {
    await db.insert(adminLogs).values({
      action: entry.action,
      details: entry.details ? JSON.stringify(entry.details) : null,
      targetType: entry.targetType,
      targetId: entry.targetId,
      ip: entry.ip,
    });
  } catch (err) {
    console.error("[log] Erro ao salvar log:", err);
  }
}
