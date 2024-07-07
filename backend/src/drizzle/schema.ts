import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const songs = sqliteTable('songs', {
  id: integer('id').primaryKey(),
  artist: text('artist'),
  title: text('title'),
  path: text('path').notNull().unique(),
  genre: text('genre').default('Sertanejo'),
})

export const artists = sqliteTable('artists', {
  id: integer('id').primaryKey(),
  name: text('name'),
  bio: text('bio'),
  pic: text('pic'),
})