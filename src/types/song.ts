export interface Song {
  id: number;
  title: string;
  artist: string;
  path: string;
}

export interface PlayerData {
  title: string;
  artist: string;
  cover?: string;
}