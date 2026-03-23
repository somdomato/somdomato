/**
 * Script para criar o primeiro usuário admin.
 * Uso: pnpm tsx src/db/seed-admin.ts <email> <senha> <nome>
 *
 * Exemplo: pnpm tsx src/db/seed-admin.ts admin@somdomato.com.br minhasenha "Admin"
 */
import "dotenv/config";
// import { drizzle } from "drizzle-orm/libsql";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { generateSalt, hashPassword } from "../lib/password";

// const db = drizzle(process.env.DB_FILE_NAME!, { schema: { users } });

const [, , email, password, name = "Admin"] = process.argv;

if (!email || !password) {
  console.error("Uso: pnpm tsx src/db/seed-admin.ts <email> <senha> [nome]");
  process.exit(1);
}

const existing = await db.query.users.findFirst({
  where: eq(users.email, email),
});

if (existing) {
  console.error(`Usuário com email "${email}" já existe.`);
  process.exit(1);
}

const salt = generateSalt();
const hashed = await hashPassword(password, salt);

await db.insert(users).values({
  name,
  email,
  password: hashed,
  salt,
  role: "admin",
});

console.log(`✓ Admin criado: ${name} <${email}>`);
