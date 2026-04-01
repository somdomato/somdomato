import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { asc, like, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { generateSalt, hashPassword } from "@/lib/password";
import { ALL_ROLES, type Role } from "@/lib/permissions";
import { logAction } from "@/lib/logging";

export async function GET(request: NextRequest) {
  const session = await requireAuth("users:manage");
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit")) || 25),
  );
  const search = searchParams.get("search")?.trim() || "";
  const offset = (page - 1) * limit;

  let query = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users);

  if (search) {
    query = query.where(
      or(like(users.name, `%${search}%`), like(users.email, `%${search}%`)),
    ) as typeof query;
  }

  const allUsers = await query.orderBy(asc(users.createdAt));
  const total = allUsers.length;
  const paginated = allUsers.slice(offset, offset + limit);

  return NextResponse.json({
    users: paginated,
    total,
    pages: Math.ceil(total / limit),
    currentUserRole: session.role,
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth("users:manage");
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { name, email, password, role } = body;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json(
      { error: "Nome, email e senha são obrigatórios" },
      { status: 400 },
    );
  }

  if (role === "super_admin") {
    return NextResponse.json(
      { error: "Não é possível criar um super admin" },
      { status: 403 },
    );
  }

  const validRole: Role = ALL_ROLES.includes(role) ? role : "user";

  // Check duplicate email
  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email.trim()),
  });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um usuário com este email" },
      { status: 409 },
    );
  }

  const salt = generateSalt();
  const hashed = await hashPassword(password, salt);

  const [created] = await db
    .insert(users)
    .values({
      name: name.trim(),
      email: email.trim(),
      password: hashed,
      salt,
      role: validRole,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    });

  await logAction({
    action: "user:created",
    targetType: "user",
    targetId: created.id,
    details: { name: created.name, email: created.email, role: created.role },
  });

  return NextResponse.json({ success: true, user: created }, { status: 201 });
}
