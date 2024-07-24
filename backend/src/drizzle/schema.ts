import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name')
})

export const artists = sqliteTable('artists', {
  id: integer('id').primaryKey(),
  name: text('name')
})

export const songs = sqliteTable('songs', {
  id: integer('id').primaryKey(),
  artist: text('artist'),
  title: text('title'),
  path: text('path').notNull().unique(),
  genre: text('genre').default('Sertanejo')
})

export const songsRelations = relations(songs, ({ one }) => ({
  request: one(requests, {
    fields: [songs.id],
    references: [requests.id]
  })
}))

export const requests = sqliteTable('requests', {
  id: integer('id').primaryKey(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  songId: integer('song_id').references(() => songs.id),
  requesterId: integer('requester_id').references(() => users.id)
})

export const history = sqliteTable('history', {
  id: integer('id').primaryKey(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  songId: integer('song_id').references(() => songs.id),
  requester: text('requester').default('AutoDJ')
})

export const historyRelations = relations(history, ({ one }) => ({
  song: one(songs, {
    fields: [history.songId],
    references: [songs.id]
  })
}))