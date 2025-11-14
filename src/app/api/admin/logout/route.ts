import { NextResponse } from "next/server";

export async function POST() {
  const cookie = `admin_jwt=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  return NextResponse.json(
    { success: true },
    { headers: { "Set-Cookie": cookie } },
  );
}
