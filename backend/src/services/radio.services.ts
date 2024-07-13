import { Glob } from 'bun'

export async function getRandomFile(genre: string): Promise<string> {
  const files = []
  const songsPath = `/media/songs/${genre}`  
  const glob = new Glob(`${songsPath}/**/*.mp3`)
  
  for await (const file of glob.scan(songsPath)) {
    files.push(`${file}`)
  }

  return files[Math.floor(Math.random() * files.length)]
}