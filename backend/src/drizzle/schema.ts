import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

export const songs = sqliteTable('songs', {
  id: integer('id').primaryKey(),
  artist: text('artist'),
  title: text('title'),
  path: text('path').notNull().unique(),
  genre: text('genre').default('Sertanejo'),
})

// export const songsRelations = relations(songs, ({ one, many }) => ({
//   user: one(users, {
//     fields: [profiles.userId],
//     references: [users.id]
//   }),
//   comments: many(comments),
//   likes: many(likes)
// }))

export const artists = sqliteTable('artists', {
  id: integer('id').primaryKey(),
  name: text('name'),
  bio: text('bio'),
  pic: text('pic'),
})

export const requests = sqliteTable('requests', {
  id: integer('id').primaryKey(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
})