export interface Song {
  id: number;
  title: string;
  artist: string;
  path: string;
  cover: string | null;
  timeSlots: number | null;
  createdAt: Date | null;
}

export interface PlayerData {
  title: string;
  artist: string;
  cover?: string;
}