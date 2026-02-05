import { Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="sticky z-40 bg-background bottom-0 p-4">
      &copy; 2011-2026 Rádio Som do Mato. Por{" "}
      <Heart className="cursor-pointer inline-block w-4 h-4 text-red-500 mx-1 hover:scale-175 hover:drop-shadow-sm hover:drop-shadow-red-600 transition ease-in-out duration-300" />{" "}
      a música sertaneja.
    </footer>
  );
}
