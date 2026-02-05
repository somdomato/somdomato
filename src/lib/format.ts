/**
 * Formata um timestamp em tempo relativo (ex: "há 5 minutos", "há 2 horas")
 * @param timestamp - Timestamp em milissegundos ou objeto Date
 * @returns String formatada em português com tempo relativo
 */
export function formatRelativeTime(
  timestamp: number | Date | null | undefined,
): string {
  if (!timestamp) return "agora";

  const now = Date.now();
  const time = typeof timestamp === "number" ? timestamp : timestamp.getTime();
  const diffMs = now - time;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  if (diffHour < 24) return `há ${diffHour}h`;
  if (diffDay === 1) return "ontem";
  if (diffDay < 7) return `há ${diffDay}d`;
  if (diffDay < 30) return `há ${Math.floor(diffDay / 7)}sem`;
  if (diffDay < 365) return `há ${Math.floor(diffDay / 30)}m`;
  return `há ${Math.floor(diffDay / 365)}a`;
}
