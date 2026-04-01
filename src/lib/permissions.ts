export const SUPER_ADMIN_EMAIL = "somdomato@somdomato.com";

export const ALL_PERMISSIONS = [
  "songs:manage",
  "requests:manage",
  "uploads:manage",
  "logs:view",
  "users:manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "songs:manage": "Gerenciar Músicas",
  "requests:manage": "Gerenciar Pedidos",
  "uploads:manage": "Gerenciar Envios",
  "logs:view": "Ver Logs",
  "users:manage": "Gerenciar Usuários",
};

export const ALL_ROLES = ["user", "moderator", "admin", "super_admin"] as const;
export type Role = (typeof ALL_ROLES)[number];

export const ADMIN_ROLES: readonly Role[] = [
  "moderator",
  "admin",
  "super_admin",
];

export const ROLE_LABELS: Record<Role, string> = {
  user: "Usuário",
  moderator: "Moderador",
  admin: "Admin",
  super_admin: "Super Admin",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    "songs:manage",
    "requests:manage",
    "uploads:manage",
    "logs:view",
    "users:manage",
  ],
  moderator: ["uploads:manage", "requests:manage", "logs:view"],
};
