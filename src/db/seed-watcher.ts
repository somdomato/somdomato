import seedUtils from "@/db/seedUtils";

async function main() {
  const musicPath = process.env.MUSIC_PATH;
  if (!musicPath) {
    console.error("MUSIC_PATH not set");
    process.exit(1);
  }
  const stats = await seedUtils.scanAndUpsertAllFiles(musicPath);
  console.log(`[seed-watcher] processed=${stats.processed} new=${stats.newOrUpdated} updated=${stats.updated} skipped=${stats.skipped}`);
}

(async () => {
  await main();
})();
