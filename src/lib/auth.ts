import { cookies } from "next/headers";
import { getUserFromSession } from "./session";
import { ADMIN_ROLES, type Permission, type Role } from "./permissions";
import { db } from "@/db";
import { rolePermissions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function requireAuth(requiredPermission?: Permission) {
  const cookieStore = await cookies();
  const session = getUserFromSession(cookieStore);

  if (!session || !ADMIN_ROLES.includes(session.role as Role)) {
    return null;
  }

  if (session.role === "super_admin") return session;

  if (requiredPermission) {
    const perm = await db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.role, session.role),
          eq(rolePermissions.permission, requiredPermission),
        ),
      )
      .limit(1)
      .get();
    if (!perm) return null;
  }

  return session;
}
