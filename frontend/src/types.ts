export interface Song {
  id: number
  artist: string
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

// export interface Song {
//   audio_info: string
//   bitrate: number
//   channels: number
//   genre: string
//   listener_peak: number
//   listeners: number
//   listenurl: string
//   samplerate:	number
//   server_description:	string
//   server_name: string
//   server_type: string
//   server_url: string
//   stream_start: string
//   stream_start_iso8601: string
//   title: string
// }