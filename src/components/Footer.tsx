import Link from "next/link";
import { Heart } from "lucide-react";
import {
  SiFacebook,
  SiX,
  SiInstagram,
  SiReddit,
} from "@icons-pack/react-simple-icons";

export default function Footer() {
  return (
    <footer className="flex flex-col items-center fixed bottom-0 left-0 w-full z-40 bg-background shadow-t-md border-t-2 border-black/50 p-4 text-center text-sm md:text-base">
      <div className="flex gap-2 mb-2">
        <Link href="https://facebook.somdomato.com" target="_blank">
          <SiFacebook
            size="20"
            className="text-white/80 hover:text-[#1877f2] transitions-colors duration-450"
          />
        </Link>
        <Link href="https://x.somdomato.com" target="_blank">
          <SiX
            size="20"
            className="text-white/80 hover:text-[#1da1f2] transitions-colors duration-450"
          />
        </Link>
        <Link href="https://instagram.somdomato.com" target="_blank">
          <SiInstagram
            size="20"
            className="text-white/80 hover:text-[#405de6] transitions-colors duration-450"
          />
        </Link>
        <Link href="https://reddit.somdomato.com" target="_blank">
          <SiReddit
            size="20"
            className="text-white/80 hover:text-[#ff4500] transitions-colors duration-450"
          />
        </Link>
      </div>
      <div>
        &copy; 2011-2026 Rádio Som do Mato. <br />
        Por{" "}
        <Heart className="cursor-pointer inline-block w-4 h-4 text-red-500 mx-1 hover:scale-175 hover:drop-shadow-sm hover:drop-shadow-red-600 transition ease-in-out duration-300" />{" "}
        a música sertaneja.
      </div>
    </footer>
  );
}
