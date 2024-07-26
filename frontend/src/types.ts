export interface Song {
  id: number
  artist: string
  artistId?: number | null
  title: string
  path: string
  genre: string
}

export interface History {
	id: number
	createdAt: string
	songId: number
	requester: string
	song: Song
}

export interface WebSocketEvent {
  action: string
  message?: string
  song?: Song | Song[]
}