import { Glob } from 'bun'

export async function getRandomFile(genre: string): Promise<string> {
  const files = []
  const songsPath = `${Bun.env.SONGS_PATH}${genre}`  
  const glob = new Glob(`${songsPath}**/*.mp3`)
  
  for await (const file of glob.scan(songsPath)) {
    files.push(`${songsPath}/${file}`)
  }

  return files[Math.floor(Math.random() * files.length)]
}