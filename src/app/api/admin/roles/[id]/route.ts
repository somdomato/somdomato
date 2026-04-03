import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { roles, rolePermissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { logAction } from "@/lib/logging";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json(
      { error: "Apenas o super admin pode editar cargos" },
      { status: 403 },
    );
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const role = await db.select().from(roles).where(eq(roles.id, id)).get();
  if (!role) {
    return NextResponse.json(
      { error: "Cargo não encontrado" },
      { status: 404 },
    );
  }

  // Protect super_admin role from being modified
  if (role.name === "super_admin") {
    return NextResponse.json(
      { error: "Não é possível editar o cargo Super Admin" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { label, isAdmin } = body;

  const updateFields: Record<string, unknown> = {};
  if (label?.trim()) updateFields.label = label.trim();
  if (isAdmin !== undefined) updateFields.isAdmin = isAdmin ? 1 : 0;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json(
      { error: "Nenhum campo para atualizar" },
      { status: 400 },
    );
  }

  await db.update(roles).set(updateFields).where(eq(roles.id, id));

  await logAction({
    action: "role:updated",
    targetType: "role",
    targetId: id,
    details: { name: role.name, ...updateFields },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json(
      { error: "Apenas o super admin pode excluir cargos" },
      { status: 403 },
    );
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const role = await db.select().from(roles).where(eq(roles.id, id)).get();
  if (!role) {
    return NextResponse.json(
      { error: "Cargo não encontrado" },
      { status: 404 },
    );
  }

  // Protect system roles from being deleted
  const protectedRoles = ["super_admin", "admin", "moderator", "user"];
  if (protectedRoles.includes(role.name)) {
    return NextResponse.json(
      { error: "Não é possível excluir cargos do sistema" },
      { status: 403 },
    );
  }

  // Check if any users have this role
  const usersWithRole = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, role.name))
    .limit(1)
    .get();

  if (usersWithRole) {
    return NextResponse.json(
      {
        error:
          "Existem usuários com este cargo. Altere o cargo deles primeiro.",
      },
      { status: 409 },
    );
  }

  // Delete role permissions
  await db.delete(rolePermissions).where(eq(rolePermissions.role, role.name));
  // Delete role
  await db.delete(roles).where(eq(roles.id, id));

  await logAction({
    action: "role:deleted",
    targetType: "role",
    targetId: id,
    details: { name: role.name, label: role.label },
  });

  return NextResponse.json({ success: true });
}
