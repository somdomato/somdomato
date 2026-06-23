"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "./Navbar";
import Player from "./Player";
import MobileGenreSelector from "./MobileGenreSelector";
import MobileShareButton from "./MobileShareButton";

// TODO: definir o caminho final do vídeo de fundo do logo
const LOGO_VIDEO_SRC = "https://cdn.somdomato.com/videos/optimized/7353106-uhd_3840_2160_24fps_button.webm";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-black/50">
      {/* Background com fallback */}
      <div
        className="absolute inset-0 -z-20 bg-background bg-wood bg-repeat-x bg-top bg-contain"
        style={
          { "--bg-wood": "url('/images/wood.jpg')" } as React.CSSProperties
        }
      />

      {/* Overlay escuro */}
      <div className="absolute inset-0 -z-10 bg-background/90" />

      {/* Layout Desktop */}
      <div className="hidden md:flex items-center justify-between p-2">
        <Link
          href="/"
          className="group relative -mx-2 -my-1 flex items-center gap-2 overflow-hidden rounded-lg px-2 py-1 font-bold text-2xl logo"
        >
          {/* Fundo com vídeo contínuo e máscaras */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0">
            <video
              src={LOGO_VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <span className="absolute inset-0 bg-[#3b2418]/50" />
            <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(20,10,5,0.25)_60%,rgba(8,4,2,0.85)_100%)]" />
          </span>

          <span className="relative z-10 flex items-center gap-2">
            <Image
              src="/images/logotipo.svg"
              alt="Rádio Som do Mato"
              width={40}
              height={40}
              className="shrink-0"
            />
            <span className="shrink-0">Rádio Som do Mato</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Navbar />
          <Player />
        </div>
      </div>

      {/* Layout Mobile */}
      <div className="md:hidden">
        {/* Linha 1: Player full-bleed */}
        <Player hideExtras className="w-full" />

        {/* Linha 2: Logo + Gênero + Compartilhar + Hamburger */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/5">
          <Link
            href="/"
            className="group relative -mx-1.5 -my-1 flex items-center gap-1.5 overflow-hidden rounded-lg px-1.5 py-1 font-bold text-sm logo"
          >
            {/* Fundo com vídeo contínuo e máscaras */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0">
              <video
                src={LOGO_VIDEO_SRC}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              <span className="absolute inset-0 bg-[#3b2418]/50" />
              <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(20,10,5,0.25)_60%,rgba(8,4,2,0.85)_100%)]" />
            </span>

            <span className="relative z-10 flex items-center gap-1.5">
              <Image
                src="/images/logotipo.svg"
                alt="Rádio Som do Mato"
                width={26}
                height={26}
                className="shrink-0"
              />
              <span className="shrink-0">Som do Mato</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <MobileGenreSelector />
            <MobileShareButton />
            <Navbar />
          </div>
        </div>
      </div>
    </header>
  );
}
