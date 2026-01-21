import Link from "next/link";
import Image from "next/image";
import Navbar from "./Navbar";
import Player from "./Player";

export default function Header() {
  return (
    <header className="md:flex md:items-center md:justify-between sticky z-50 bg-background top-0 p-4 border-b-3 border-black/50">
      <Link 
        href="/"
        className="flex items-center gap-4 font-bold text-2xl"
      >
        <Image
          src="/images/logotipo.svg"
          alt="Rádio Som do Mato"
          width={50}
          height={50}
          className="shrink-0"
        />
        <span className="shrink-0">
          Rádio Som do Mato
        </span>
      </Link>
      <div className="flex gap-2">
        <Navbar />
        <Player />
      </div>
    </header>
  );
}
