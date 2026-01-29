"use client";

import Link from "next/link";
import { useAuth, LoginForm } from "@/components/AdminAuth";
import { SongsTable } from "@/components/SongsTable";
import { Music, ListOrdered, LogOut } from "lucide-react";

export default function AdminPage() {
  const { password, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated || !password) {
    return <LoginForm onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background-alt border-b border-primary/30">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm hover:text-primary transition-colors">
              Ver Site
            </Link>
            <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md transition-colors">
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-background-alt border-b border-primary/30">
        <div className="container mx-auto px-4">
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-6 py-3 border-b-2 border-primary text-primary">
              <Music size={20} />
              Músicas
            </div>
            <Link href="/admin/requests" className="flex items-center gap-2 px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors">
              <ListOrdered size={20} />
              Pedidos
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <SongsTable />
      </main>
    </div>
  );
}
