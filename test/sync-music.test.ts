import { describe, it, expect, beforeAll, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import NodeID3 from "node-id3";
import { readID3Tags, updateID3Tags } from "../scripts/sync-music";

describe("sync-music id3 helpers", () => {
  const tmpDir = path.join(os.tmpdir(), "somdomato-tests");
  let filePath: string;

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch {}
    }
  });

  it("reads and writes genre tags on mp3", async () => {
    filePath = path.join(tmpDir, `test-${Date.now()}.mp3`);
    // create an empty file first
    await fs.writeFile(filePath, Buffer.alloc(1024));

    // write initial tags via node-id3 directly
    const ok = NodeID3.update(
      { title: "t", artist: "a", genre: "Sertanejo" },
      filePath,
    );
    expect(ok).toBeTruthy();

    const tags = await readID3Tags(filePath);
    expect(tags).toBeTruthy();
    expect(tags!.genre).toBe("Sertanejo");

    // update via helper
    const updated = updateID3Tags(filePath, { genre: "Sertanejo" });
    expect(updated).toBe(true);

    const tags2 = await readID3Tags(filePath);
    expect(tags2).toBeTruthy();
    expect(tags2!.genre).toBe("Sertanejo");
  });
});
