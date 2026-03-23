"use client";

import Link from "next/link";
import { SongsTable } from "@/components/SongsTable";
import { Music, ListOrdered, Upload } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

export default function AdminPage() {
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
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-6 py-3 border-b-2 border-primary text-primary">
              <Music size={20} />
              Músicas
            </div>
            <Link
              href="/admin/requests"
              className="flex items-center gap-2 px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors"
            >
              <ListOrdered size={20} />
              Pedidos
            </Link>
            <Link
              href="/admin/uploads"
              className="flex items-center gap-2 px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors"
            >
              <Upload size={20} />
              Envios
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
