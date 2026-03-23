const LOCAL_IPS = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "localhost",
]);

function isPrivateIP(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.") ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}

/**
 * Verifica se a requisição veio de localhost ou rede interna (Docker).
 *
 * - Liquidsoap em produção: `curl http://localhost:3000/...` → sem headers de proxy → permite
 * - Liquidsoap no Docker: `http://nextjs:3000/...` → sem headers de proxy → permite
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

  // Sem headers de proxy = conexão direta (localhost ou Docker)
  return true;
}
