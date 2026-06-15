import fs from "node:fs/promises";

/**
 * Verifica se um arquivo existe no disco.
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
