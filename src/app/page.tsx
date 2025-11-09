import Image from "next/image";

export default function Home() {
  return (
    <>
      <Image
        className="w-full h-auto"
        src="/images/logo.svg"
        alt="Rádio Som do Mato logo"
        width={600}
        height={200}
        priority
      />
      <iframe 
        src="https://chat.somdomato.com" 
        className="w-full aspect-video rounded-lg border-2 border-black/60 ring-2 ring-black/60" 
      />
    </>
  );
}
