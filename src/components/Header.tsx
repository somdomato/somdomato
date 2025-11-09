"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ListMusic, X, Home, Music, Users } from "lucide-react";
import AudioPlayer from "./AudioPlayer";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky z-50 bg-background top-0 border-b-2 border-b-black/50 shadow-sm">
        <div className="container mx-auto flex h-16 items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-2xl shrink-0">
            <Image
              src="/images/logotipo.svg"
              alt="Rádio Som do Mato"
              width={40}
              height={40}
              priority
            />
            <span className="hidden md:block">Som do Mato</span>
            <span className="block md:hidden">SDM</span>
          </Link>
          <div className="flex flex-1 items-center justify-end md:justify-between">
            <nav aria-label="Global" className="hidden md:block">
              <ul className="flex items-center gap-6 text-sm">
                <li>
                  <Link 
                    href="/"
                    className="text-gray-500 transition hover:text-gray-500/75"
                  >
                    Início
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/pedidos"
                    className="text-gray-500 transition hover:text-gray-500/75"
                  >
                    Pedir Música
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/admin"
                    className="text-gray-500 transition hover:text-gray-500/75"
                  >
                    Admin
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="flex items-center gap-2">
              {/* <div className="md:flex md:gap-4"> */}
                <AudioPlayer />
              {/* </div> */}
              <button 
                onClick={() => setOpen(!open)} 
                className="block rounded-sm bg-background border-2 border-black/50 p-2.5 text-gray-300 transition hover:text-gray-600/75 md:hidden"
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label="Toggle mobile menu"
              >
                {open ? <X className="size-5" /> : <ListMusic className="size-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Menu Mobile */}
      <div 
        id="mobile-menu"
        className={`md:hidden bg-background border-b-2 border-b-black/50 shadow-lg transition-all duration-300 ease-in-out ${
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <nav className="container mx-auto py-4">
          <ul className="space-y-2">
            <li>
              <Link 
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition hover:bg-gray-100 hover:text-gray-900"
              >
                <Music className="size-5" />
                <span>Nome da Música</span>
              </Link>
            </li>
            <li>
              <Link 
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition hover:bg-gray-100 hover:text-gray-900"
              >
                <Home className="size-5" />
                <span>Início</span>
              </Link>
            </li>
            <li>
              <Link 
                href="/pedir"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition hover:bg-gray-100 hover:text-gray-900"
              >
                <Music className="size-5" />
                <span>Pedir Música</span>
              </Link>
            </li>
            <li>
              <Link 
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-gray-600 rounded-lg transition hover:bg-gray-100 hover:text-gray-900"
              >
                <Users className="size-5" />
                <span>Admin</span>
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
