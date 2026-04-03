import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSession } from "@/lib/session";
import { ADMIN_ROLES } from "@/lib/permissions";
import { db } from "@/db";
import { rolePermissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const cookieStore = await cookies();
  const session = getUserFromSession(cookieStore);

  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ isAdmin: false });
  }

  // Get user's permissions
  let permissions: string[] = [];
  if (session.role === "super_admin") {
    // Super admin has all permissions
    const { ALL_PERMISSIONS } = await import("@/lib/permissions");
    permissions = [...ALL_PERMISSIONS];
  } else {
    const perms = await db
      .select({ permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(eq(rolePermissions.role, session.role));
    permissions = perms.map((p) => p.permission);
  }

  // Get user name
  const user = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, Number(session.id)))
    .limit(1)
    .get();

  return NextResponse.json({
    isAdmin: true,
    role: session.role,
    permissions,
    name: user?.name || null,
  });
}
