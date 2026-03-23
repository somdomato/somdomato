import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSession } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const session = getUserFromSession(cookieStore);
  return NextResponse.json({ isAdmin: session?.role === "admin" });
}
