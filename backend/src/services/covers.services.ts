import { db } from '@/drizzle'
import { or, eq } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'

const spotifyApi = 'https://api.spotify.com/v1'

export async function spotifyGetToken() {
  const token = await (await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      'grant_type': 'client_credentials',
      'client_id': process.env.SPOTIFY_CLIENT_ID as string,
      'client_secret': process.env.SPOTIFY_CLIENT_SECRET as string
    })
  })).json()

  if (token.error) return { message: 'Erro ao obter token', ok: false }
  return { message: 'Token obtido com sucesso', token: token.access_token, ok: true }
}

export async function spotifyGetArtistInfo(artist: string) {
  const { token } = await spotifyGetToken()
  const term = encodeURIComponent(artist)
  
  const info = await (await fetch(`https://api.spotify.com/v1/search?q=${term}&type=artist`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })).json()

  const name = info.artists.items[0].name.trim()
  if (!name) return { message: 'Artista não encontrado', ok: false }
  
  const url = info.artists.items[0].images[0].url
  if (!url) return { message: 'Artista não encontrado', ok: false }
  
  const safeName = name.replace(/[^A-Z0-9]+/ig, '_').toLowerCase()
  
  const result = await fetch(url)
  if (!result.headers.get("Content-Type")?.endsWith('jpeg')) return { message: 'Erro ao obter imagem', ok: false }
  
  const path = `./${safeName}.jpg`
  await Bun.write(path, result)

  console.log({ message: 'Imagem obtida com sucesso', image: path, ok: true })
  return { message: 'Imagem obtida com sucesso', image: path, ok: true }
}

spotifyGetArtistInfo('Racionais MCs')

