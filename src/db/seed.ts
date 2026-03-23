import "dotenv/config";
import { users } from "./schema";
import { db } from "./index";
import { generateSalt, hashPassword } from "../lib/password";
import seedUtils from "./utils";

const email = process.env.ADMIN_EMAIL!;
const password = process.env.ADMIN_PASSWORD!;
const salt = generateSalt();
const hashed = await hashPassword(password, salt);

await db
  .insert(users)
  .values({
    name: "Admin",
    email,
    password: hashed,
    salt,
    role: "admin",
  })
  .onConflictDoUpdate({
    target: users.email,
    set: {
      name: "Admin",
      password: hashed,
      salt,
      role: "admin",
    },
  });

console.log(`✓ Admin criado: Admin <${email}>`);

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
