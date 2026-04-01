import "dotenv/config";
import { users, rolePermissions } from "./schema";
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
