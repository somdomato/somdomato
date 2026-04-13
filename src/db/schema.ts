import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  email: text().notNull().unique(),
  password: text(),
  salt: text(),
  role: text().default("user"), // "user" | "admin"
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: int({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const songs = sqliteTable("songs", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  artist: text().notNull(),
  album: text(), // Álbum da música
  path: text().notNull().unique(),
  cover: text().default("/images/logotipo.svg"), // Nova coluna para URL da capa
  timeSlots: int().default(15), // Sistema de bits: 0=nenhum, 1=madrugada, 2=manhã, 4=tarde, 8=noite, 15=todos
  rotation: text().default("normal"), // inativo, leve, normal, pesado
  genre: text().default("geral"), // geral, gaucha, modao, arrocha, romantico, forro
  allowedInGeneral: int().default(0), // 0=não, 1=sim - permite música de outro gênero tocar no Geral
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
  requests: int().default(0),
  likes: int().default(0),
});

export const requests = sqliteTable("requests", {
  id: int().primaryKey({ autoIncrement: true }),
  songId: int()
    .notNull()
    .references(() => songs.id),
  order: int().notNull().default(0), // Ordem dos pedidos
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const history = sqliteTable("history", {
  id: int().primaryKey({ autoIncrement: true }),
  songId: int()
    .notNull()
    .references(() => songs.id),
  genre: text().notNull().default("geral"), // Gênero do mountpoint onde tocou
  wasRequested: int().default(0), // 1 se foi pedido pelo usuário, 0 se foi AutoDJ
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

// =============================================================================
// ESTATÍSTICAS DO SITE
// =============================================================================

export const pageViews = sqliteTable("page_views", {
  id: int().primaryKey({ autoIncrement: true }),
  page: text().notNull(), // Caminho da página ("/", "/pedidos", etc.)
  ip: text().notNull(), // IP do visitante (para identificar únicos)
  userAgent: text(), // User agent do navegador
  sessionId: text(), // Identificador de sessão (para agrupar cliques da mesma visita)
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
});

// =============================================================================
// ADMIN LOGS
// =============================================================================

export const adminLogs = sqliteTable("admin_logs", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int(), // ID of the user who performed the action
  action: text().notNull(), // "upload:approved", "upload:rejected", "upload:deleted", "upload:ai_approved", "song:updated", "song:deleted", "request:added", "request:removed", "admin:skip", etc.
  details: text(), // JSON string with additional context
  targetType: text(), // "upload", "song", "request"
  targetId: int(), // ID of the affected record
  ip: text(), // IP of the actor
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
});

// =============================================================================
// PERMISSÕES POR CARGO
// =============================================================================

export const rolePermissions = sqliteTable("role_permissions", {
  id: int().primaryKey({ autoIncrement: true }),
  role: text().notNull(), // "admin", "moderator"
  permission: text().notNull(), // "songs:manage", "uploads:manage", etc.
});

// =============================================================================
// CARGOS (ROLES)
// =============================================================================

export const roles = sqliteTable("roles", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(), // "super_admin", "admin", "moderator", "locutor", "user"
  label: text().notNull(), // "Super Admin", "Admin", "Moderador", "Locutor", "Ouvinte"
  isAdmin: int().default(0), // 1 = pode acessar o painel admin
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
});

// =============================================================================
// VINHETAS (JINGLES)
// =============================================================================

export const jingles = sqliteTable("jingles", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  filename: text().notNull(),
  path: text().notNull().unique(),
  duration: int(), // Duração em segundos
  active: int().default(1), // 1=ativo, 0=inativo
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
});

// =============================================================================
// CONFIGURAÇÕES DO SISTEMA
// =============================================================================

export const settings = sqliteTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
});

// =============================================================================
// UPLOADS (ENVIOS DE USUÁRIOS)
// =============================================================================

export const uploads = sqliteTable("uploads", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  artist: text().notNull(),
  deezerUrl: text().notNull(), // URL original do Deezer
  deezerId: text().notNull(), // ID da faixa
  thumbnail: text(), // Thumbnail do vídeo
  filename: text().notNull(), // Nome do arquivo baixado
  path: text().notNull(), // Caminho completo do arquivo
  duration: int(), // Duração em segundos (do Deezer)
  deezerGenre: text(), // Gênero reportado pelo Deezer (ex: "Sertanejo")
  status: text().default("pending"), // pending, approved, rejected, ai_approved
  autoApproved: int().default(0), // 1 se foi auto-aprovado
  aiReason: text(), // Justificativa da IA para aprovação/rejeição
  autoApproveAt: int({ mode: "timestamp" }), // Quando será auto-aprovado (null = não elegível)
  autoApproveGenre: text(), // Gênero a usar na auto-aprovação
  createdAt: int({ mode: "timestamp" }).$defaultFn(() => new Date()),
});
