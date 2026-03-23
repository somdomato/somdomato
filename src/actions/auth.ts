"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { comparePasswords } from "@/lib/password";
import { createUserSession, removeUserFromSession } from "@/lib/session";

export async function signIn(
  _prevState: { error: string },
  formData: FormData,
) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Preencha todos os campos" };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user || !user.password || !user.salt) {
    return { error: "Email ou senha incorretos" };
  }

  if (user.role !== "admin") {
    return { error: "Acesso não autorizado" };
  }

  const isValid = await comparePasswords({
    password,
    salt: user.salt,
    hashedPassword: user.password,
  });

  if (!isValid) {
    return { error: "Email ou senha incorretos" };
  }

  const cookieStore = await cookies();
  await createUserSession(
    { id: user.id, role: user.role ?? "user" },
    cookieStore,
  );
  redirect("/admin");
}

export async function logOut() {
  const cookieStore = await cookies();
  await removeUserFromSession(cookieStore);
  redirect("/admin/login");
}
