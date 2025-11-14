import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const songs = sqliteTable("songs", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  artist: text().notNull(),
  path: text().notNull().unique(),
  cover: text().default("/images/logotipo.svg"), // Nova coluna para URL da capa
  timeSlots: int().default(15), // Sistema de bits: 0=nenhum, 1=madrugada, 2=manhã, 4=tarde, 8=noite, 15=todos
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
  requests: int().default(0),
  likes: int().default(0),
});

export const requests = sqliteTable("requests", {
  id: int().primaryKey({ autoIncrement: true }),
  songId: int()
    .notNull()
    .references(() => songs.id),
});

export const history = sqliteTable("history", {
  id: int().primaryKey({ autoIncrement: true }),
  songId: int()
    .notNull()
    .references(() => songs.id),
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const likes = sqliteTable("likes", {
  id: int().primaryKey({ autoIncrement: true }),
  songId: int()
    .notNull()
    .references(() => songs.id),
  userIp: text().notNull(), // IP do usuário para identificação
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Relações corretas
export const songsRelations = relations(songs, ({ many }) => ({
  requests: many(requests),
  history: many(history),
  likes: many(likes),
}));

export const requestsRelations = relations(requests, ({ one }) => ({
  song: one(songs, {
    fields: [requests.songId],
    references: [songs.id],
  }),
}));

export const historyRelations = relations(history, ({ one }) => ({
  song: one(songs, {
    fields: [history.songId],
    references: [songs.id],
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  song: one(songs, {
    fields: [likes.songId],
    references: [songs.id],
  }),
}));
