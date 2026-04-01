import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { generateSalt, hashPassword } from "@/lib/password";
import { SUPER_ADMIN_EMAIL, ALL_ROLES, type Role } from "@/lib/permissions";
import { logAction } from "@/lib/logging";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth("users:manage");
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 },
    );
  }

  const body = await request.json();
  const { name, email, password, role } = body;

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

  // Cannot change super admin's role
  if (isSuperAdmin && role && role !== "super_admin") {
    return NextResponse.json(
      { error: "Não é possível alterar o cargo do super admin" },
      { status: 403 },
    );
  }

  // Cannot set anyone to super_admin
  if (role === "super_admin" && !isSuperAdmin) {
    return NextResponse.json(
      { error: "Não é possível promover a super admin" },
      { status: 403 },
    );
  }

  const updateFields: Record<string, unknown> = {};

  if (name?.trim()) updateFields.name = name.trim();

  if (email?.trim() && email.trim() !== user.email) {
    if (isSuperAdmin) {
      return NextResponse.json(
        { error: "Não é possível alterar o email do super admin" },
        { status: 403 },
      );
    }
    const existing = await db.query.users.findFirst({
      where: (u, { eq: eqOp }) => eqOp(u.email, email.trim()),
    });
    if (existing) {
      return NextResponse.json(
        { error: "Já existe um usuário com este email" },
        { status: 409 },
      );
    }
    updateFields.email = email.trim();
  }

  if (role && !isSuperAdmin && ALL_ROLES.includes(role as Role)) {
    updateFields.role = role;
  }

  if (password?.trim()) {
    const salt = generateSalt();
    const hashed = await hashPassword(password.trim(), salt);
    updateFields.password = hashed;
    updateFields.salt = salt;
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json(
      { error: "Nenhum campo para atualizar" },
      { status: 400 },
    );
  }

  await db.update(users).set(updateFields).where(eq(users.id, id));

  await logAction({
    action: "user:updated",
    targetType: "user",
    targetId: id,
    details: {
      name: (updateFields.name as string) || user.name,
      role: (updateFields.role as string) || user.role,
      passwordChanged: !!password?.trim(),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth("users:manage");
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 },
    );
  }

  if (user.email === SUPER_ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "Não é possível excluir o super admin" },
      { status: 403 },
    );
  }

  if (String(id) === session.id) {
    return NextResponse.json(
      { error: "Não é possível excluir a si mesmo" },
      { status: 403 },
    );
  }

  await db.delete(users).where(eq(users.id, id));

  await logAction({
    action: "user:deleted",
    targetType: "user",
    targetId: id,
    details: { name: user.name, email: user.email },
  });

  return NextResponse.json({ success: true });
}
