"use client";

import Link from "next/link";
import { useAuth } from "@/components/AdminAuth";

export default function Navbar() {
  const { isAuthenticated } = useAuth();

  return (
    <nav className="flex items-center gap-2 md:gap-4 m-0">
      <Link href="/" className="font-semibold">
        Início
      </Link>
      <Link href="/pedidos" className="font-semibold">
        Pedidos
      </Link>
      <Link href="/artists" className="font-semibold">
        Artistas
      </Link>
      {isAuthenticated && (
        <Link href="/admin" className="font-semibold">
          Painel
        </Link>
      )}
    </nav>
  );
}
