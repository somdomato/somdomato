import Image from "next/image";

export default function NotFound() {
  return (
    <div className="w-full h-full flex items-center justify-center px-2">
      <Image src="/images/logo.svg" alt="Rádio Som do Mato" width={800} height={800} sizes="(max-width: 768px) 90vw, 50vw" className="block mx-auto max-w-full max-h-full object-contain" />
    </div>
  );
}
