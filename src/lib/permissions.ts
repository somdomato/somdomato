export const SUPER_ADMIN_EMAIL = "somdomato@somdomato.com";

export const ALL_PERMISSIONS = [
  "songs:edit_tags",
  "songs:edit_file",
  "songs:delete",
  "requests:manage",
  "uploads:manage",
  "logs:view",
  "users:manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "songs:edit_tags": "Editar Tags ID3",
  "songs:edit_file": "Editar Arquivo",
  "songs:delete": "Apagar Música",
  "requests:manage": "Gerenciar Pedidos",
  "uploads:manage": "Gerenciar Envios",
  "logs:view": "Ver Logs",
  "users:manage": "Gerenciar Usuários",
};

export const PERMISSION_GROUPS: Record<string, Permission[]> = {
  Músicas: ["songs:edit_tags", "songs:edit_file", "songs:delete"],
  Pedidos: ["requests:manage"],
  Envios: ["uploads:manage"],
  Logs: ["logs:view"],
  Usuários: ["users:manage"],
};

export const ALL_ROLES = [
  "user",
  "locutor",
  "moderator",
  "admin",
  "super_admin",
] as const;
export type Role = (typeof ALL_ROLES)[number];

export const ADMIN_ROLES: readonly Role[] = [
  "locutor",
  "moderator",
  "admin",
  "super_admin",
];

export const ROLE_LABELS: Record<Role, string> = {
  user: "Ouvinte",
  locutor: "Locutor",
  moderator: "Moderador",
  admin: "Admin",
  super_admin: "Super Admin",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    "songs:edit_tags",
    "songs:edit_file",
    "songs:delete",
    "requests:manage",
    "uploads:manage",
    "logs:view",
    "users:manage",
  ],
  moderator: ["uploads:manage", "requests:manage", "logs:view"],
  locutor: ["requests:manage"],
};

/** Check if a role has any songs-related permission */
export function hasSongsAccess(permissions: string[]): boolean {
  return permissions.some((p) =>
    ["songs:edit_tags", "songs:edit_file", "songs:delete"].includes(p),
  );
}
