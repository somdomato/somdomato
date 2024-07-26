import { unlink } from 'fs/promises'

export async function moveFile(oldFile: string, newFile: string) {
  const file = Bun.file(oldFile)
  const success = await Bun.write(newFile, file)
  
  if (success) {
    await unlink(oldFile)
    return newFile
  } else {
    return null
  }
}