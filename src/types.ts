import type { songs, requests, history } from "@/db/schema";

export type SongData = typeof songs.$inferSelect;
export type Requests = typeof requests.$inferSelect;
export type History = typeof history.$inferSelect;

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
  id?: number;
  title: string;
  artist: string;
  cover?: string;
}

export interface SongWithRequests extends Requests {
  songs: Song;
  requestsCount: number;
}

export type HistoryWithSongs = {
  history: History;
  song: Song;
};

export type SongEntry = { id: number; title: string; artist: string; cover: string | null; count: number };
export type TopEntry = SongEntry;
