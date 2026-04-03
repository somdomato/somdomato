import "dotenv/config";
import { users, rolePermissions, roles } from "./schema";
import { db } from "./index";
import { generateSalt, hashPassword } from "../lib/password";
import {
  SUPER_ADMIN_EMAIL,
  DEFAULT_ROLE_PERMISSIONS,
} from "../lib/permissions";
import { eq } from "drizzle-orm";
import seedUtils from "./utils";

const email = process.env.ADMIN_EMAIL!;
const password = process.env.ADMIN_PASSWORD!;
const salt = generateSalt();
const hashed = await hashPassword(password, salt);

const role = email === SUPER_ADMIN_EMAIL ? "super_admin" : "admin";

await db
  .insert(users)
  .values({
    name: "Admin",
    email,
    password: hashed,
    salt,
    role,
  })
  .onConflictDoUpdate({
    target: users.email,
    set: {
      name: "Admin",
      password: hashed,
      salt,
      role,
    },
  });

console.log(`✓ Admin criado: Admin <${email}> (${role})`);

// Seed default roles
const defaultRoles = [
  { name: "super_admin", label: "Super Admin", isAdmin: 1 },
  { name: "admin", label: "Admin", isAdmin: 1 },
  { name: "moderator", label: "Moderador", isAdmin: 1 },
  { name: "locutor", label: "Locutor", isAdmin: 1 },
  { name: "user", label: "Ouvinte", isAdmin: 0 },
];

for (const r of defaultRoles) {
  await db.insert(roles).values(r).onConflictDoNothing();
}
console.log(
  `✓ Cargos padrão inseridos: ${defaultRoles.map((r) => r.label).join(", ")}`,
);

// Migrate old songs:manage permission to new granular permissions
const oldSongsManage = await db
  .select()
  .from(rolePermissions)
  .where(eq(rolePermissions.permission, "songs:manage"));

for (const entry of oldSongsManage) {
  // Replace songs:manage with the 3 granular permissions
  await db.delete(rolePermissions).where(eq(rolePermissions.id, entry.id));
  await db.insert(rolePermissions).values([
    { role: entry.role, permission: "songs:edit_tags" },
    { role: entry.role, permission: "songs:edit_file" },
    { role: entry.role, permission: "songs:delete" },
  ]);
  console.log(
    `✓ Migrado songs:manage → permissões granulares para "${entry.role}"`,
  );
}

// Seed default role permissions
for (const [roleName, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
  // Clear existing permissions for this role
  await db.delete(rolePermissions).where(eq(rolePermissions.role, roleName));
  if (perms.length > 0) {
    await db
      .insert(rolePermissions)
      .values(perms.map((permission) => ({ role: roleName, permission })));
  }
  console.log(`✓ Permissões padrão para "${roleName}": ${perms.join(", ")}`);
}

async function main() {
  const musicPath = process.env.MUSIC_PATH;
  if (!musicPath) {
    console.error("MUSIC_PATH not set");
    process.exit(1);
  }
  const stats = await seedUtils.scanAndUpsertAllFiles(musicPath);
  console.log(
    `[seed] processed=${stats.processed} new=${stats.newOrUpdated} updated=${stats.updated} skipped=${stats.skipped}`,
  );
}

(async () => {
  await main();
})();
