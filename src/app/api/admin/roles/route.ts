import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { roles, rolePermissions } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { logAction } from "@/lib/logging";

export async function GET() {
  const session = await requireAuth("users:manage");
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allRoles = await db.select().from(roles).orderBy(asc(roles.id));

  // Get permissions for each role
  const allPerms = await db.select().from(rolePermissions);
  const permsByRole: Record<string, string[]> = {};
  for (const p of allPerms) {
    if (!permsByRole[p.role]) permsByRole[p.role] = [];
    permsByRole[p.role].push(p.permission);
  }

  return NextResponse.json({
    roles: allRoles.map((r) => ({
      ...r,
      permissions: permsByRole[r.name] || [],
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json(
      { error: "Apenas o super admin pode criar cargos" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { name, label, isAdmin } = body;

  if (!name?.trim() || !label?.trim()) {
    return NextResponse.json(
      { error: "Nome e rótulo são obrigatórios" },
      { status: 400 },
    );
  }

  // Validate slug format
  const slug = name.trim().toLowerCase().replace(/\s+/g, "_");
  if (!/^[a-z_]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Nome deve conter apenas letras minúsculas e underscore" },
      { status: 400 },
    );
  }

  // Protect system roles from being duplicated
  if (["super_admin"].includes(slug)) {
    return NextResponse.json(
      { error: "Não é possível criar este cargo" },
      { status: 403 },
    );
  }

  try {
    const [created] = await db
      .insert(roles)
      .values({
        name: slug,
        label: label.trim(),
        isAdmin: isAdmin ? 1 : 0,
      })
      .returning();

    await logAction({
      action: "role:created",
      targetType: "role",
      targetId: created.id,
      details: { name: slug, label: label.trim() },
    });

    return NextResponse.json({ success: true, role: created }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Já existe um cargo com este nome" },
      { status: 409 },
    );
  }
}
