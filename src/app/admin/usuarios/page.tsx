"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  Music,
  ListOrdered,
  Upload,
  ScrollText,
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string | null;
}

interface RolePermissions {
  [role: string]: string[];
}

const ALL_PERMISSIONS = [
  "songs:manage",
  "requests:manage",
  "uploads:manage",
  "logs:view",
  "users:manage",
] as const;

const PERMISSION_LABELS: Record<string, string> = {
  "songs:manage": "Músicas",
  "requests:manage": "Pedidos",
  "uploads:manage": "Envios",
  "logs:view": "Logs",
  "users:manage": "Usuários",
};

const ROLE_LABELS: Record<string, string> = {
  user: "Usuário",
  moderator: "Moderador",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-gray-600/30 text-gray-300 border-gray-600/40",
  moderator: "bg-blue-600/20 text-blue-300 border-blue-600/40",
  admin: "bg-primary/20 text-primary border-primary/40",
  super_admin: "bg-purple-600/20 text-purple-300 border-purple-600/40",
};

const EDITABLE_ROLES = ["user", "moderator", "admin"];
const CONFIGURABLE_ROLES = ["admin", "moderator"];

const SUPER_ADMIN_EMAIL = "somdomato@somdomato.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UsuariosPage() {
  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });
  const [saving, setSaving] = useState(false);

  // Permissions state
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=25`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPages(data.pages || 0);
      setCurrentUserRole(data.currentUserRole || "");
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    try {
      const res = await fetch("/api/admin/permissions");
      const data = await res.json();
      if (!res.ok) return;
      setRolePermissions(data.permissions || {});
    } catch {
      // Silently fail — user might not have permission
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (currentUserRole === "super_admin") {
      loadPermissions();
    }
  }, [currentUserRole, loadPermissions]);

  // ---------------------------------------------------------------------------
  // CRUD handlers
  // ---------------------------------------------------------------------------

  const handleCreate = async () => {
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.password.trim()
    ) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Usuário criado");
      setShowAddModal(false);
      setFormData({ name: "", email: "", password: "", role: "user" });
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
      };
      if (formData.password.trim()) {
        body.password = formData.password;
      }
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Usuário atualizado");
      setEditingUser(null);
      setFormData({ name: "", email: "", password: "", role: "user" });
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Excluir "${user.name}" (${user.email})?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Usuário excluído");
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
  };

  // ---------------------------------------------------------------------------
  // Permissions handlers
  // ---------------------------------------------------------------------------

  const togglePermission = async (role: string, permission: string) => {
    const current = rolePermissions[role] || [];
    const newPerms = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];

    // Optimistic update
    setRolePermissions((prev) => ({ ...prev, [role]: newPerms }));

    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, permissions: newPerms }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Revert
        setRolePermissions((prev) => ({ ...prev, [role]: current }));
        throw new Error(data.error);
      }
      toast.success(`Permissões de "${ROLE_LABELS[role]}" atualizadas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isSuperAdmin = currentUserRole === "super_admin";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background-alt border-b border-primary/30">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm hover:text-primary transition-colors"
            >
              Ver Site
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-background-alt border-b border-primary/30">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Music size={18} />
              <span className="hidden sm:inline">Músicas</span>
            </Link>
            <Link
              href="/admin/requests"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <ListOrdered size={18} />
              <span className="hidden sm:inline">Pedidos</span>
            </Link>
            <Link
              href="/admin/uploads"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Envios</span>
            </Link>
            <Link
              href="/admin/logs"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <ScrollText size={18} />
              <span className="hidden sm:inline">Logs</span>
            </Link>
            <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-primary text-primary whitespace-nowrap text-sm">
              <Users size={18} />
              <span className="hidden sm:inline">Usuários</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Header + Add button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Usuários</h2>
            <p className="text-sm text-gray-500">
              {total} usuário{total !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({ name: "", email: "", password: "", role: "user" });
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/85 text-background font-semibold rounded-lg transition-all active:scale-95 text-sm"
          >
            <Plus size={16} />
            Adicionar
          </button>
        </div>

        {/* Users table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
            <Users className="w-10 h-10 opacity-20" />
            <p className="text-sm">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="bg-background-alt rounded-xl border border-primary/15 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    Cargo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden md:table-cell">
                    Criado em
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 w-24">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSuper = user.email === SUPER_ADMIN_EMAIL;
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isSuper && (
                            <Shield
                              size={14}
                              className="text-purple-400 shrink-0"
                            />
                          )}
                          <div>
                            <div className="font-semibold text-white truncate max-w-40">
                              {user.name}
                            </div>
                            <div className="text-xs text-gray-500 sm:hidden truncate max-w-40">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-gray-300 truncate block max-w-48">
                          {user.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border ${ROLE_COLORS[user.role] || ROLE_COLORS.user}`}
                        >
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-gray-500 text-xs">
                          {formatDate(user.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(user)}
                            className="p-1.5 text-white/30 hover:text-primary transition rounded-lg hover:bg-white/5"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          {!isSuper && (
                            <button
                              onClick={() => handleDelete(user)}
                              className="p-1.5 text-white/30 hover:text-red-400 transition rounded-lg hover:bg-white/5"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-gray-600">
              Página {page} de {pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-background-alt border border-primary/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-2 rounded-lg bg-background-alt border border-primary/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Permissions matrix (super admin only) ── */}
        {isSuperAdmin && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-purple-400" />
              <h3 className="text-base font-bold text-white">
                Permissões por Cargo
              </h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Configure quais permissões cada cargo possui. O Super Admin sempre
              tem acesso total.
            </p>

            {permissionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : (
              <div className="bg-background-alt rounded-xl border border-primary/15 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/6">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                        Cargo
                      </th>
                      {ALL_PERMISSIONS.map((perm) => (
                        <th
                          key={perm}
                          className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap"
                        >
                          {PERMISSION_LABELS[perm]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CONFIGURABLE_ROLES.map((role) => (
                      <tr
                        key={role}
                        className="border-b border-white/5 hover:bg-white/3 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border ${ROLE_COLORS[role]}`}
                          >
                            {ROLE_LABELS[role]}
                          </span>
                        </td>
                        {ALL_PERMISSIONS.map((perm) => {
                          const hasPermission = (
                            rolePermissions[role] || []
                          ).includes(perm);
                          return (
                            <td key={perm} className="px-3 py-3 text-center">
                              <button
                                onClick={() => togglePermission(role, perm)}
                                className={`w-8 h-8 rounded-lg border transition-all ${
                                  hasPermission
                                    ? "bg-primary/20 border-primary/50 text-primary"
                                    : "bg-background/50 border-white/10 text-gray-600 hover:border-white/20"
                                }`}
                                title={
                                  hasPermission
                                    ? `Remover ${PERMISSION_LABELS[perm]}`
                                    : `Adicionar ${PERMISSION_LABELS[perm]}`
                                }
                              >
                                {hasPermission ? "✓" : ""}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Add User Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-background-alt border border-white/10 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-base font-bold text-white">Novo Usuário</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Nome *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  placeholder="Nome do usuário"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Senha *
                </label>
                <input
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, password: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  placeholder="Senha"
                />
              </div>
              <div>
                <label
                  htmlFor="role"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Cargo
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, role: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                >
                  {EDITABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg transition-colors text-sm text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/85 disabled:opacity-50 text-background font-semibold rounded-lg transition-all active:scale-95 text-sm"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-background-alt border border-white/10 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-base font-bold text-white">Editar Usuário</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Nome *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, email: e.target.value }))
                  }
                  disabled={editingUser.email === SUPER_ADMIN_EMAIL}
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Nova Senha{" "}
                  <span className="text-gray-600">
                    (deixe vazio para manter)
                  </span>
                </label>
                <input
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, password: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  placeholder="••••••"
                />
              </div>
              <div>
                <label
                  htmlFor="role"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Cargo
                </label>
                {editingUser.email === SUPER_ADMIN_EMAIL ? (
                  <div className="px-3 py-2 bg-background/50 border border-white/10 rounded-lg text-sm text-purple-300 flex items-center gap-2">
                    <Shield size={14} />
                    Super Admin
                  </div>
                ) : (
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, role: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  >
                    {EDITABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg transition-colors text-sm text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/85 disabled:opacity-50 text-background font-semibold rounded-lg transition-all active:scale-95 text-sm"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Pencil size={14} />
                )}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
