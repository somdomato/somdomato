import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name'),
  username: text('username').unique().notNull(),
  email: text('email').unique().notNull(),
  password: text('password').notNull()
})

export const usersRelations = relations(users, ({ many }) => ({
  tokens: many(tokens)
}))

export const tokens = sqliteTable('tokens', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').references(() => artists.id),
  refreshToken: text('refresh_token'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`)
})

export const tokensRelations = relations(tokens, ({ one }) => ({
  user: one(users, {
    fields: [tokens.userId],
    references: [users.id]
  })
}))

export const artists = sqliteTable('artists', {
  id: integer('id').primaryKey(),
  name: text('name').unique().notNull(),
  pic: text('pic').default('/images/ogp.png')
})

export const artistsRelations = relations(artists, ({ many }) => ({
  songs: many(songs)
}))

export const songs = sqliteTable('songs', {
  id: integer('id').primaryKey(),
  artist: text('artist'),
  artistId: integer('artist_id').references(() => artists.id),
  title: text('title'),
  path: text('path').notNull().unique(),
  genre: text('genre').default('Sertanejo'),
  likes: integer('likes').default(0),
  requestedAt: text('created_at'),
  playedAt: text('created_at'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  // 100 => ultraheavy, 75 => heavy, 50 => normal, 25 => light, 0 => ultralight
  weight: integer('weight').default(50) 
})

export const songsRelations = relations(songs, ({ one }) => ({
  request: one(requests, {
    fields: [songs.id],
    references: [requests.id]
  }),
  artist: one(artists, {
    fields: [songs.artist],
    references: [artists.name]
  }),
  history: one(history, {
    fields: [songs.id],
    references: [history.songId]
  })
}))

export const requests = sqliteTable('requests', {
  id: integer('id').primaryKey(),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  artistId: integer('artist_id').references(() => artists.id),
  songId: integer('song_id').references(() => songs.id),
  requesterId: integer('requester_id').references(() => users.id),
  requested: integer('requested').default(0),
  played: integer('played', { mode: 'boolean' }).default(false)
})

export const requestsRelations = relations(requests, ({ one }) => ({
  song: one(songs, {
    fields: [requests.songId],
    references: [songs.id],
    relationName: 'song_request'
  })
}))

export const history = sqliteTable('history', {
  id: integer('id').primaryKey(),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  artistId: integer('artist_id').references(() => artists.id),
  songId: integer('song_id').references(() => songs.id),
  requester: text('requester').default('AutoDJ')
})

export const historyRelations = relations(history, ({ one }) => ({
  artist: one(artists, {
    fields: [history.artistId],
    references: [artists.id]
  }),
  song: one(songs, {
    fields: [history.songId],
    references: [songs.id]
  })
}))