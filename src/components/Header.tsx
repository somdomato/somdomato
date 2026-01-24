import Link from "next/link";
import Image from "next/image";
import Navbar from "./Navbar";
import Player from "./Player";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-black/50 p-1 md:flex md:items-center md:justify-between md:p-2 relative">
      {/* Background com fallback */}
      <div className="absolute inset-0 -z-20 bg-background bg-[url('/images/wood.jpg')] bg-repeat-x bg-top bg-contain" />

      {/* Overlay escuro */}
      <div className="absolute inset-0 -z-10 bg-background/90" />

      <Link href="/" className="flex items-center gap-2 font-bold md:gap-4 sm:text-xl md:text-2xl logo">
        <Image src="/images/logotipo.svg" alt="Rádio Som do Mato" width={40} height={40} className="shrink-0" />
        <span className="hidden shrink-0 md:inline-block">Rádio Som do Mato</span>
        <span className="inline-block shrink-0 md:hidden">SDM</span>
      </Link>
      <div className="mt-2 gap-2 space-y-0 md:mt-0 md:flex md:items-center md:space-y-2">
        <Navbar />
        <Player />
      </div>
    </header>
  );
}
