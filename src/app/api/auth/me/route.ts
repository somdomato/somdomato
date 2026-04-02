import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSession } from "@/lib/session";
import { ADMIN_ROLES } from "@/lib/permissions";

export async function GET() {
  const cookieStore = await cookies();
  const session = getUserFromSession(cookieStore);
  return NextResponse.json({
    isAdmin: session != null && ADMIN_ROLES.includes(session.role),
  });
}
