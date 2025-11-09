import { readdir } from "node:fs/promises";

export async function getAllFilesRecursive(dir: string): Promise<string[]> {
  const dirents = await readdir(dir, { recursive: true, withFileTypes: true });
  const files: string[] = [];
  for (const dirent of dirents) {
    if (dirent.isFile()) files.push(`${dir}/${dirent.name}`);
  }
  return files;
}

export async function getRandomFile(directoryPath: string): Promise<string | undefined> {
  const files = await getAllFilesRecursive(directoryPath);
  if (files.length === 0) return undefined; // No files found
  const index = Math.floor(Math.random() * files.length);
  return files[index];
}