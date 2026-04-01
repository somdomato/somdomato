import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rolePermissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";
import { logAction } from "@/lib/logging";

export async function GET() {
  const session = await requireAuth("users:manage");
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const rows = await db.select().from(rolePermissions);

  const grouped: Record<string, string[]> = {};
  for (const row of rows) {
    if (!grouped[row.role]) grouped[row.role] = [];
    grouped[row.role].push(row.permission);
  }

  return NextResponse.json({ permissions: grouped });
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json(
      { error: "Apenas o super admin pode alterar permissões" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { role, permissions } = body;

  if (!role || role === "user" || role === "super_admin") {
    return NextResponse.json(
      { error: "Cargo inválido para edição de permissões" },
      { status: 400 },
    );
  }

  if (!Array.isArray(permissions)) {
    return NextResponse.json(
      { error: "Permissões devem ser um array" },
      { status: 400 },
    );
  }

  const validPerms = permissions.filter((p: string) =>
    ALL_PERMISSIONS.includes(p as Permission),
  );

  // Delete existing permissions for this role, then insert new ones
  await db.delete(rolePermissions).where(eq(rolePermissions.role, role));

  if (validPerms.length > 0) {
    await db
      .insert(rolePermissions)
      .values(validPerms.map((permission: string) => ({ role, permission })));
  }

  await logAction({
    action: "permissions:updated",
    targetType: "user",
    details: { role, permissions: validPerms },
  });

  return NextResponse.json({ success: true });
}
