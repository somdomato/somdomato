import Image from "next/image";

export default function Home() {
  return (
    <div className="mb-6">
      <div className="m-6">
        <Image
          className="w-full h-auto"
          src="/images/logo.svg"
          alt="Rádio Som do Mato logo"
          width={600}
          height={200}
          priority
        />
      </div>
      <iframe
        src="https://chat.somdomato.com"
        className="w-full min-h-[600px] aspect-video md:rounded-lg border-2 border-black/60 ring-2 ring-black/60 focus:outline-none"
      />
    </div>
  );
}
