"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "./Navbar";
import Player from "./Player";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-black/50 relative">
      {/* Background com fallback */}
      <div className="absolute inset-0 -z-20 bg-background bg-[url('/images/wood.jpg')] bg-repeat-x bg-top bg-contain" />

      {/* Overlay escuro */}
      <div className="absolute inset-0 -z-10 bg-background/90" />

      {/* Layout Desktop */}
      <div className="hidden md:flex items-center justify-between p-2">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-2xl logo"
        >
          <Image
            src="/images/logotipo.svg"
            alt="Rádio Som do Mato"
            width={40}
            height={40}
            className="shrink-0"
          />
          <span className="shrink-0">Rádio Som do Mato</span>
        </Link>
        <div className="flex items-center gap-2">
          <Navbar />
          <Player />
        </div>
      </div>

      {/* Layout Mobile */}
      <div className="md:hidden">
        {/* Linha 1: Logo + Hamburger */}
        <div className="flex items-center justify-between p-2">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl logo"
          >
            <Image
              src="/images/logotipo.svg"
              alt="Rádio Som do Mato"
              width={40}
              height={40}
              className="shrink-0"
            />
            <span className="shrink-0">Som do Mato</span>
          </Link>
          <Navbar />
        </div>

        {/* Linha 2: Player 100% largura */}
        <div className="px-2 pb-2">
          <Player className="w-full" />
        </div>
      </div>
    </header>
  );
}
