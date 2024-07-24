import { db } from '@/drizzle'
import * as schema from '@/drizzle/schema'
import { broadcastMessage } from '@/utils/websocket'
import YTDlpWrap from 'yt-dlp-wrap'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')

const ytDlpWrap = new YTDlpWrap()

export async function downloadSong(url: string) {
  const title = await getVideoTitle(url)

  ytDlpWrap.exec([url, '-x', '--audio-format', 'mp3', '--cookies', `${ROOT}/cookies.txt`, '-o', title])
    .on('progress', (progress) => {
      const progressData = JSON.stringify({
        action: 'upload',
        percent: progress.percent,
        totalSize: progress.totalSize,
        currentSpeed: progress.currentSpeed,
        eta: progress.eta,
      })

      broadcastMessage(progressData)
    })
    .on('ytDlpEvent', (eventType, eventData) => console.log(eventType, eventData))
    .on('error', (error) => console.error(error))
    .on('close', () => broadcastMessage(JSON.stringify({ action: 'upload', message: 'Upload concluido', ok: true })))

    return { message: 'Download concluído', ok: true }
}

async function getVideoTitle(url: string) {
  let metadata = await ytDlpWrap.getVideoInfo(url)
  return metadata.title
}