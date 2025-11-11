import { songs, requests, history } from "@/db/schema";

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
  title: string;
  artist: string;
  cover?: string;
}

export interface SongWithRequests extends Requests {
  songs: Song;
  requestsCount: number;
}

export interface SongWithHistory extends History {
  songs: Song;
}