import { NextResponse } from "next/server";
import { createAdminJWT } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  const body = await request.json();
  const token = body?.token;

  if (!adminToken && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "ADMIN_TOKEN not configured" },
      { status: 500 },
    );
  }

  // In dev if ADMIN_TOKEN not set, accept any token and create a JWT using a dev secret
  const secret = adminToken || "dev-secret";

  if (adminToken && token !== adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jwt = createAdminJWT(secret);

  const cookie = `admin_jwt=${encodeURIComponent(jwt)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24}; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

  return NextResponse.json(
    { success: true },
    { headers: { "Set-Cookie": cookie } },
  );
}
