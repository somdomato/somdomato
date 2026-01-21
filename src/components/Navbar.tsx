import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex items-center gap-2 md:gap-4">
      <Link 
        href="/"
        className="font-semibold text-xl"
      >
        Início
      </Link>      
    </nav>
  );
}
