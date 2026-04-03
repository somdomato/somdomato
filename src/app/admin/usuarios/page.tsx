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
  Lock,
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

interface RoleItem {
  id: number;
  name: string;
  label: string;
  isAdmin: number;
  permissions: string[];
}

interface RolePermissions {
  [role: string]: string[];
}

const ALL_PERMISSIONS = [
  "songs:edit_tags",
  "songs:edit_file",
  "songs:delete",
  "requests:manage",
  "uploads:manage",
  "logs:view",
  "users:manage",
] as const;

const PERMISSION_LABELS: Record<string, string> = {
  "songs:edit_tags": "Editar Tags",
  "songs:edit_file": "Editar Arquivo",
  "songs:delete": "Apagar Música",
  "requests:manage": "Pedidos",
  "uploads:manage": "Envios",
  "logs:view": "Logs",
  "users:manage": "Usuários",
};

const PERMISSION_GROUPS: Record<string, string[]> = {
  Músicas: ["songs:edit_tags", "songs:edit_file", "songs:delete"],
  Pedidos: ["requests:manage"],
  Envios: ["uploads:manage"],
  Logs: ["logs:view"],
  Usuários: ["users:manage"],
};

const ROLE_LABELS: Record<string, string> = {
  user: "Ouvinte",
  locutor: "Locutor",
  moderator: "Moderador",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-gray-600/30 text-gray-300 border-gray-600/40",
  locutor: "bg-cyan-600/20 text-cyan-300 border-cyan-600/40",
  moderator: "bg-blue-600/20 text-blue-300 border-blue-600/40",
  admin: "bg-primary/20 text-primary border-primary/40",
  super_admin: "bg-purple-600/20 text-purple-300 border-purple-600/40",
};

const SUPER_ADMIN_EMAIL = "somdomato@somdomato.com";
const PROTECTED_ROLES = ["super_admin", "admin", "moderator", "user"];

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
  // Auth state
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserPermissions, setCurrentUserPermissions] = useState<
    string[]
  >([]);
  const [authChecked, setAuthChecked] = useState(false);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);

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

  // Permissions & Roles state
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [rolesList, setRolesList] = useState<RoleItem[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    label: "",
    isAdmin: false,
  });
  const [savingRole, setSavingRole] = useState(false);

  // ---------------------------------------------------------------------------
  // Check auth first
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        setCurrentUserRole(data.role || "");
        setCurrentUserPermissions(data.permissions || []);
      } catch {
        // Silently fail
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  const hasUsersPermission =
    currentUserRole === "super_admin" ||
    currentUserPermissions.includes("users:manage");
  const isSuperAdmin = currentUserRole === "super_admin";

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadUsers = useCallback(async () => {
    if (!hasUsersPermission) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=25`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPages(data.pages || 0);
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, [page, hasUsersPermission]);

  const loadPermissions = useCallback(async () => {
    if (!isSuperAdmin) return;
    setPermissionsLoading(true);
    try {
      const res = await fetch("/api/admin/permissions");
      const data = await res.json();
      if (!res.ok) return;
      setRolePermissions(data.permissions || {});
    } catch {
      // Silently fail
    } finally {
      setPermissionsLoading(false);
    }
  }, [isSuperAdmin]);

  const loadRoles = useCallback(async () => {
    if (!isSuperAdmin) return;
    setRolesLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      const data = await res.json();
      if (!res.ok) return;
      setRolesList(data.roles || []);
    } catch {
      // Silently fail
    } finally {
      setRolesLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (authChecked && hasUsersPermission) {
      loadUsers();
    }
  }, [authChecked, hasUsersPermission, loadUsers]);

  useEffect(() => {
    if (authChecked && isSuperAdmin) {
      loadPermissions();
      loadRoles();
    }
  }, [authChecked, isSuperAdmin, loadPermissions, loadRoles]);

  // ---------------------------------------------------------------------------
  // User CRUD handlers
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
      toast.success(`Permissões de "${ROLE_LABELS[role] || role}" atualizadas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  };

  // ---------------------------------------------------------------------------
  // Role CRUD handlers
  // ---------------------------------------------------------------------------

  const handleCreateRole = async () => {
    if (!roleFormData.name.trim() || !roleFormData.label.trim()) {
      toast.error("Preencha nome e rótulo");
      return;
    }
    setSavingRole(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Cargo criado");
      setShowRoleModal(false);
      setRoleFormData({ name: "", label: "", isAdmin: false });
      loadRoles();
      loadPermissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar cargo");
    } finally {
      setSavingRole(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;
    setSavingRole(true);
    try {
      const res = await fetch(`/api/admin/roles/${editingRole.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: roleFormData.label,
          isAdmin: roleFormData.isAdmin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Cargo atualizado");
      setEditingRole(null);
      setRoleFormData({ name: "", label: "", isAdmin: false });
      loadRoles();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao atualizar cargo",
      );
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (role: RoleItem) => {
    if (!confirm(`Excluir o cargo "${role.label}"?`)) return;
    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Cargo excluído");
      loadRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
  };

  // Available roles for user form (from roles table or fallback)
  const editableRoles =
    rolesList.length > 0
      ? rolesList.filter((r) => r.name !== "super_admin")
      : [
          { name: "user", label: "Ouvinte" },
          { name: "locutor", label: "Locutor" },
          { name: "moderator", label: "Moderador" },
          { name: "admin", label: "Admin" },
        ];

  // Configurable roles for permissions matrix (admin-like roles, excluding super_admin)
  const configurableRoles = rolesList
    .filter((r) => r.name !== "super_admin" && r.name !== "user")
    .map((r) => r.name);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

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
        {/* No permission */}
        {!hasUsersPermission ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-500">
            <Lock className="w-12 h-12 opacity-20" />
            <p className="text-sm">
              Você não tem permissão para gerenciar usuários.
            </p>
            <Link
              href="/admin"
              className="text-sm text-primary hover:underline"
            >
              Voltar ao painel
            </Link>
          </div>
        ) : (
          <>
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
                  setFormData({
                    name: "",
                    email: "",
                    password: "",
                    role: "user",
                  });
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
                      const roleLabel =
                        rolesList.find((r) => r.name === user.role)?.label ||
                        ROLE_LABELS[user.role] ||
                        user.role;
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
                              {roleLabel}
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

            {/* ── Roles management (super admin only) ── */}
            {isSuperAdmin && (
              <div className="mt-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Shield size={18} className="text-purple-400" />
                    <h3 className="text-base font-bold text-white">Cargos</h3>
                  </div>
                  <button
                    onClick={() => {
                      setRoleFormData({
                        name: "",
                        label: "",
                        isAdmin: false,
                      });
                      setEditingRole(null);
                      setShowRoleModal(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all text-xs font-medium"
                  >
                    <Plus size={14} />
                    Novo Cargo
                  </button>
                </div>

                {rolesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                ) : (
                  <div className="bg-background-alt rounded-xl border border-primary/15 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/6">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                            Cargo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">
                            Identificador
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                            Admin
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 w-24">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rolesList.map((role) => {
                          const isProtected = PROTECTED_ROLES.includes(
                            role.name,
                          );
                          return (
                            <tr
                              key={role.id}
                              className="border-b border-white/5 hover:bg-white/3 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border ${ROLE_COLORS[role.name] || ROLE_COLORS.user}`}
                                >
                                  {role.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <code className="text-xs text-gray-500">
                                  {role.name}
                                </code>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`text-xs ${role.isAdmin ? "text-green-400" : "text-gray-600"}`}
                                >
                                  {role.isAdmin ? "Sim" : "Não"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {role.name !== "super_admin" && (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingRole(role);
                                        setRoleFormData({
                                          name: role.name,
                                          label: role.label,
                                          isAdmin: !!role.isAdmin,
                                        });
                                        setShowRoleModal(true);
                                      }}
                                      className="p-1.5 text-white/30 hover:text-primary transition rounded-lg hover:bg-white/5"
                                      title="Editar"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    {!isProtected && (
                                      <button
                                        onClick={() => handleDeleteRole(role)}
                                        className="p-1.5 text-white/30 hover:text-red-400 transition rounded-lg hover:bg-white/5"
                                        title="Excluir"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Permissions matrix (super admin only) ── */}
            {isSuperAdmin && configurableRoles.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={18} className="text-purple-400" />
                  <h3 className="text-base font-bold text-white">
                    Permissões por Cargo
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Configure quais permissões cada cargo possui. O Super Admin
                  sempre tem acesso total.
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
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 sticky left-0 bg-background-alt">
                            Cargo
                          </th>
                          {Object.entries(PERMISSION_GROUPS).map(
                            ([group, perms]) => (
                              <th
                                key={group}
                                colSpan={perms.length}
                                className="px-2 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-l border-white/5"
                              >
                                {group}
                              </th>
                            ),
                          )}
                        </tr>
                        <tr className="border-b border-white/6">
                          <th className="px-4 py-2 sticky left-0 bg-background-alt" />
                          {ALL_PERMISSIONS.map((perm, idx) => {
                            // Add left border for first perm in each group
                            const prevPerm =
                              idx > 0 ? ALL_PERMISSIONS[idx - 1] : "";
                            const prevGroup = prevPerm.split(":")[0];
                            const curGroup = perm.split(":")[0];
                            const isGroupStart = prevGroup !== curGroup;
                            return (
                              <th
                                key={perm}
                                className={`px-2 py-2 text-center text-[10px] font-semibold text-gray-500 whitespace-nowrap ${isGroupStart ? "border-l border-white/5" : ""}`}
                              >
                                {PERMISSION_LABELS[perm]}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {configurableRoles.map((roleName) => {
                          const roleData = rolesList.find(
                            (r) => r.name === roleName,
                          );
                          const label =
                            roleData?.label ||
                            ROLE_LABELS[roleName] ||
                            roleName;
                          return (
                            <tr
                              key={roleName}
                              className="border-b border-white/5 hover:bg-white/3 transition-colors"
                            >
                              <td className="px-4 py-3 sticky left-0 bg-background-alt">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border ${ROLE_COLORS[roleName] || ROLE_COLORS.user}`}
                                >
                                  {label}
                                </span>
                              </td>
                              {ALL_PERMISSIONS.map((perm, idx) => {
                                const hasPermission = (
                                  rolePermissions[roleName] || []
                                ).includes(perm);
                                const prevPerm =
                                  idx > 0 ? ALL_PERMISSIONS[idx - 1] : "";
                                const prevGroup = prevPerm.split(":")[0];
                                const curGroup = perm.split(":")[0];
                                const isGroupStart = prevGroup !== curGroup;
                                return (
                                  <td
                                    key={perm}
                                    className={`px-2 py-3 text-center ${isGroupStart ? "border-l border-white/5" : ""}`}
                                  >
                                    <button
                                      onClick={() =>
                                        togglePermission(roleName, perm)
                                      }
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
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
                  htmlFor="add-name"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Nome *
                </label>
                <input
                  type="text"
                  id="add-name"
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
                  htmlFor="add-email"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Email *
                </label>
                <input
                  type="email"
                  id="add-email"
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
                  htmlFor="add-password"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Senha *
                </label>
                <input
                  type="password"
                  id="add-password"
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
                  htmlFor="add-role"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Cargo
                </label>
                <select
                  id="add-role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, role: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                >
                  {editableRoles.map((role) => (
                    <option key={role.name} value={role.name}>
                      {role.label}
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
                  htmlFor="edit-name"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Nome *
                </label>
                <input
                  type="text"
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-email"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Email *
                </label>
                <input
                  type="email"
                  id="edit-email"
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
                  htmlFor="edit-password"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Nova Senha{" "}
                  <span className="text-gray-600">
                    (deixe vazio para manter)
                  </span>
                </label>
                <input
                  type="password"
                  id="edit-password"
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
                  htmlFor="edit-role"
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
                    id="edit-role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, role: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  >
                    {editableRoles.map((role) => (
                      <option key={role.name} value={role.name}>
                        {role.label}
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

      {/* ── Add/Edit Role Modal ── */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-background-alt border border-white/10 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-base font-bold text-white">
                {editingRole ? "Editar Cargo" : "Novo Cargo"}
              </h3>
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setEditingRole(null);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {!editingRole && (
                <div>
                  <label
                    htmlFor="role-name"
                    className="block text-xs text-gray-500 mb-1"
                  >
                    Identificador *{" "}
                    <span className="text-gray-600">
                      (letras minúsculas e _)
                    </span>
                  </label>
                  <input
                    type="text"
                    id="role-name"
                    value={roleFormData.name}
                    onChange={(e) =>
                      setRoleFormData((p) => ({
                        ...p,
                        name: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z_]/g, ""),
                      }))
                    }
                    className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-mono"
                    placeholder="nome_do_cargo"
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="role-label"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Rótulo *
                </label>
                <input
                  type="text"
                  id="role-label"
                  value={roleFormData.label}
                  onChange={(e) =>
                    setRoleFormData((p) => ({ ...p, label: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  placeholder="Nome visível do cargo"
                />
              </div>
              <div className="flex items-center gap-3">
                <label
                  htmlFor="role-admin"
                  className="text-xs text-gray-500 flex-1"
                >
                  Pode acessar o painel admin?
                </label>
                <button
                  id="role-admin"
                  type="button"
                  onClick={() =>
                    setRoleFormData((p) => ({ ...p, isAdmin: !p.isAdmin }))
                  }
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    roleFormData.isAdmin
                      ? "bg-primary"
                      : "bg-gray-700 border border-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      roleFormData.isAdmin ? "left-4.5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setEditingRole(null);
                }}
                className="flex-1 px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg transition-colors text-sm text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={editingRole ? handleUpdateRole : handleCreateRole}
                disabled={savingRole}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/85 disabled:opacity-50 text-background font-semibold rounded-lg transition-all active:scale-95 text-sm"
              >
                {savingRole ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : editingRole ? (
                  <Pencil size={14} />
                ) : (
                  <Plus size={14} />
                )}
                {editingRole ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
