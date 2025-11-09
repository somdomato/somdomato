import Image from "next/image";

export default function Home() {
  return (
    <Image
      className="w-full h-auto"
      src="/images/logo.svg"
      alt="Rádio Som do Mato logo"
      width={600}
      height={200}
      priority
    />
  );
}
