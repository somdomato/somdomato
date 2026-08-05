const LOCAL_IPS = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "localhost",
]);

/** Normaliza IPv4-mapped IPv6 (::ffff:x.x.x.x → x.x.x.x) */
function normalizeIP(ip: string): string {
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isPrivateIP(ip: string): boolean {
  const normalized = normalizeIP(ip);
  return (
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("172.") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

/**
 * Verifica se a requisição veio de localhost ou rede interna (Podman).
 *
 * - Liquidsoap em produção: `curl http://localhost:3000/...` → sem headers de proxy → permite
 * - Liquidsoap no Podman: `http://nextjs:3000/...` → sem headers de proxy → permite
 * - Usuário externo via Nginx: Nginx seta `X-Real-IP` com IP público → bloqueia
 */
export function isLocalRequest(request: Request): boolean {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return LOCAL_IPS.has(realIp) || isPrivateIP(realIp);
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const clientIp = forwardedFor.split(",")[0].trim();
    return LOCAL_IPS.has(clientIp) || isPrivateIP(clientIp);
  }

  // Sem headers de proxy = conexão direta (localhost ou Podman)
  return true;
}
