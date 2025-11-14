import Image from "next/image";
import History from "@/components/History";
import Requests from "@/components/Requests";
import TopSongs from "@/components/TopSongs";

export default async function Home() {
  // Use the client-side History component for live updates via websocket.
  // Keep server fetched data as fallback initially if needed (not used here).
  return (
    <>
      <section className="mb-6">
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
          src="https://gamja.somdomato.com"
          // On mobile the iframe used to be taller than the viewport because of `min-h-[600px]`.
          // Use `aspect-video` for the correct aspect ratio and cap its height to 70vh
          // so the page remains scrollable on mobile. On larger screens, keep the
          // min-height to preserve desktop layout.
          className="w-full aspect-video max-h-[70vh] md:min-h-[600px] md:aspect-video md:rounded-lg border-2 border-black/60 ring-2 ring-black/60 focus:outline-none"
        />
      </section>
      <section className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TopSongs />
          <History />
          <Requests />
        </div>
      </section>
    </>
  );
}
