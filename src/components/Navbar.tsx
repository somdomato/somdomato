"use client";

import Link from "next/link";
import { useState } from "react";
import { Home, Music, Users, LayoutDashboard, Menu, X } from "lucide-react";
import { useAuth } from "@/components/AdminAuth";

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { href: "/", label: "Início", icon: Home },
    { href: "/pedidos", label: "Pedidos", icon: Music },
    { href: "/artists", label: "Artistas", icon: Users },
  ];

  if (isAuthenticated) {
    menuItems.push({
      href: "/admin",
      label: "Painel",
      icon: LayoutDashboard,
    });
  }

  return (
    <>
      {/* Botão Hamburger - Mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Menu"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Menu Desktop */}
      <nav className="hidden md:flex items-center gap-2 md:gap-4 m-0">
        {menuItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 font-semibold hover:text-primary transition-colors"
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Menu Mobile - Dropdown */}
      {isOpen && (
        <nav 
          className="md:hidden absolute left-0 right-0 top-full border-b-2 border-black/50 py-2 shadow-xl z-50 menu-mobile-enter overflow-hidden"
          style={{
            background: `linear-gradient(rgba(44, 37, 37, 0.9), rgba(44, 37, 37, 0.9)), url('/images/wood.jpg')`,
            backgroundSize: 'contain',
            backgroundRepeat: 'repeat-x',
            backgroundPosition: 'top',
            backgroundAttachment: 'fixed'
          }}
        >
          <div className="flex flex-col gap-1 px-4 relative">
            {menuItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 font-semibold py-3 px-4 rounded-lg hover:bg-white/10 transition-colors"
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
