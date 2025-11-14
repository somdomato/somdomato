import { NextResponse } from "next/server";
import crypto from "node:crypto";

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function createAdminJWT(
  secret: string,
  expiresInSeconds = 60 * 60 * 24,
) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    admin: true,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = sign(secret, `${headerB64}.${payloadB64}`);
  return `${headerB64}.${payloadB64}.${signature}`;
}

export function verifyAdminJWT(secret: string, token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, signature] = parts;
    const expected = sign(secret, `${headerB64}.${payloadB64}`);
    if (expected !== signature) return false;
    const payloadJson = Buffer.from(payloadB64, "base64").toString("utf-8");
    const payload = JSON.parse(payloadJson);
    if (!payload.admin) return false;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
      return false;
    return true;
  } catch (_e) {
    return false;
  }
}

export function requireAdmin(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  // If ADMIN_TOKEN is not set, allow access in non-production environments
  if (!adminToken) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "ADMIN_TOKEN not configured" },
        { status: 500 },
      );
    }
    return;
  }

  // Check header (legacy support)
  const headerToken = request.headers.get("x-admin-token");
  if (headerToken && headerToken === adminToken) return;

  // Check cookie admin_jwt
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(^|; )admin_jwt=([^;]+)/);
  if (match) {
    const token = decodeURIComponent(match[2]);
    if (verifyAdminJWT(adminToken, token)) return;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
