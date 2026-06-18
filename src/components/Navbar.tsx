"use client";

import { useState } from "react";
import {
  Home,
  Music,
  Users,
  LayoutDashboard,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/AdminAuth";
import { VideoButton } from "@/components/VideoButton";

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  videoSrc: string;
};

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems: MenuItem[] = [
    {
      href: "/",
      label: "Início",
      icon: Home,
      videoSrc:
        "https://cdn.somdomato.com/videos/optimized/7353106-uhd_3840_2160_24fps_button.webm",
    },
    {
      href: "/pedidos",
      label: "Pedidos",
      icon: Music,
      videoSrc:
        "https://cdn.somdomato.com/videos/optimized/7353400-uhd_3840_2160_24fps_button.webm",
    },
    {
      href: "/artistas",
      label: "Artistas",
      icon: Users,
      videoSrc:
        "https://cdn.somdomato.com/videos/optimized/11997585_3840_2160_60fps_button.webm",
    },
  ];

  if (isAuthenticated) {
    menuItems.push({
      href: "/admin",
      label: "Painel",
      icon: LayoutDashboard,
      videoSrc:
        "https://cdn.somdomato.com/videos/optimized/12280443_3840_2160_25fps_button.webm",
    });
  }

  return (
    <>
      {/* Botão Hamburger - Mobile */}
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="
          flex size-8 items-center justify-center rounded-lg
          transition-colors hover:bg-white/10
          md:hidden
        "
        aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-navbar"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Menu Desktop */}
      <nav className="m-0 hidden items-center gap-2 md:flex md:gap-4">
        {menuItems.map(({ href, label, icon, videoSrc }) => (
          <VideoButton
            key={href}
            href={href}
            icon={icon}
            videoSrc={videoSrc}
            className="hover:text-white"
          >
            {label}
          </VideoButton>
        ))}
      </nav>

      {/* Menu Mobile - Dropdown */}
      {isOpen && (
        <nav
          id="mobile-navbar"
          className="
            menu-mobile-enter absolute left-0 right-0 top-full z-50
            overflow-hidden border-y-2 border-black py-2 shadow-xl
            md:hidden
          "
          style={{
            background:
              "linear-gradient(rgba(44, 37, 37, 0.9), rgba(44, 37, 37, 0.9)), url('/images/wood.jpg')",
            backgroundSize: "contain",
            backgroundRepeat: "repeat-x",
            backgroundPosition: "top",
            backgroundAttachment: "fixed",
          }}
        >
          <div className="relative flex flex-col gap-1 px-4">
            {menuItems.map(({ href, label, icon, videoSrc }) => (
              <VideoButton
                key={href}
                href={href}
                icon={icon}
                videoSrc={videoSrc}
                className="
                  min-h-14 gap-3
                  active:scale-[0.98]
                  md:hover:scale-[1.02]
                "
              >
                {label}
              </VideoButton>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
