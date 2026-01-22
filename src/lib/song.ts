import { readdir } from "node:fs/promises";
import path from "node:path";

export async function getAllFilesRecursive(dir: string): Promise<string[]> {
  // Implement explicit recursive traversal so this works across Node/Bun versions
  // without relying on readdir's `recursive` option which is only supported
  // in newer Node versions. This is more robust and portable.
  const results: string[] = [];

  async function walk(directory: string) {
    const dirents = await readdir(directory, { withFileTypes: true });
    for (const dirent of dirents) {
      const resolved = path.join(directory, dirent.name);
      if (dirent.isDirectory()) await walk(resolved);
      else if (dirent.isFile()) results.push(resolved);
    }
  }

  await walk(dir);
  return results;
}

export async function getRandomFile(directoryPath: string): Promise<string | undefined> {
  const files = await getAllFilesRecursive(directoryPath);
  if (files.length === 0) return undefined; // No files found
  const index = Math.floor(Math.random() * files.length);
  return files[index];
}
