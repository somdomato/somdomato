import { Glob } from 'bun'

const SONGS = Bun.env.SONGS_PATH as string

export async function getRandomFile(genre: string): Promise<string> {
  const files = []
  const songsPath = `${SONGS}/${genre}`  
  const glob = new Glob(`${songsPath}/**/*.mp3`)
  
  for await (const file of glob.scan(songsPath)) {
    files.push(`${file}`)
  }

  return files[Math.floor(Math.random() * files.length)]
}