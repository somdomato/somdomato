import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky z-50 bg-background top-0">
      <div className="container mx-auto">
        <Link href="/" className="flex items-center gap-2 text-2xl">
          <Image
            src="/images/logotipo.svg"
            alt="Rádio Som do Mato"
            width={40}
            height={40}
            priority
          />
          <span className="hidden md:block">Rádio Som do Mato</span>
          <span className="block md:hidden">SDM</span>
        </Link>
      </div>
    </header>
  );
}
