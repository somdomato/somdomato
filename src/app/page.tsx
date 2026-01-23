import Image from "next/image";

export default function Home() {
  return (
    <div className="w-full h-full flex items-center justify-center px-2">
      {/* <main className="flex-1 flex items-center justify-center min-h-0 w-full px-2 md:px-4">{children}</main> */}
      <Image src="/images/logo.svg" alt="Rádio Som do Mato" width={800} height={800} priority className="block mx-auto h-auto max-w-3xl object-contain" />
    </div>
  );
}
