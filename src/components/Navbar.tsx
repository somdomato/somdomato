import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex items-center gap-2 md:gap-4 m-0">
      <Link href="/" className="font-semibold">
        Início
      </Link>
    </nav>
  );
}
