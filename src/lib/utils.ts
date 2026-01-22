export function getFilenameFromPath(fullPath: string): string {
  const lastSlashIndex = fullPath.lastIndexOf("/");
  const lastBackslashIndex = fullPath.lastIndexOf("\\");
  const lastSeparatorIndex = Math.max(lastSlashIndex, lastBackslashIndex);

  if (lastSeparatorIndex === -1) {
    // No path separator found, the input is already just a filename
    return fullPath;
  } else {
    // Extract the substring after the last separator
    return fullPath.slice(lastSeparatorIndex + 1);
  }
}
