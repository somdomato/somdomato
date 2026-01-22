import Link from "next/link";
import Image from "next/image";
import Navbar from "./Navbar";
import Player from "./Player";

export default function Header() {
  return (
    <header className="md:flex md:items-center md:justify-between sticky z-50 bg-background top-0 p-1 md:p-2 border-b-2 border-black/50">
      <Link href="/" className="flex items-center gap-2 md:gap-4 font-bold sm:text-xl md:text-2xl">
        <Image src="/images/logotipo.svg" alt="Rádio Som do Mato" width={40} height={40} className="shrink-0" />
        <span className="hidden md:inline-block shrink-0">Rádio Som do Mato</span>
        <span className="inline-block md:hidden shrink-0">SDM</span>
      </Link>
      <div className="md:flex md:items-center gap-2 space-y-0 md:space-y-2 mt-2 md:mt-0">
        <Navbar />
        <Player />
      </div>
    </header>
  );
}
