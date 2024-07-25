import YTDlpWrap from 'yt-dlp-wrap-plus'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const ytDlpWrap = new YTDlpWrap()

async function folderExists(directory: string): Promise<boolean> {
  const file = Bun.file(directory)
  return await file.exists()
}

export async function createPath(directory: string): Promise<string | boolean> {
  try {
    await mkdir(directory, { recursive: true })
    return true
  } catch (err) {
    console.error(err)
  }

  return directory
}

export async function downloadSong(url: string) {
  const path = `${ROOT}/uploads`
  if (!await folderExists(path)) await createPath(path)
  const title = await getVideoInfo(url)
  // const formatted = title.substring(title.lastIndexOf('/')+1).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  const formatted = title.replace(/\//g, '-').normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  const file = `${path}/${formatted}.mp3`

  try {
    await ytDlpWrap.execPromise([url, '--cookies', `${ROOT}/cookies.txt`, '--audio-format', 'mp3', '-x', '--restrict-filenames', '-o', file])
    return { message: 'Download concluído', file, ok: true }  
  } catch (error) {
    return { message: 'Erro ao realizar download', ok: false }    
  }
}

async function getVideoInfo(url: string) {
  const metadata = JSON.parse((await ytDlpWrap.execPromise([url, '-q', '--no-warnings', '--dump-json', '--cookies', `${ROOT}/cookies.txt`])))
  return metadata.title
}