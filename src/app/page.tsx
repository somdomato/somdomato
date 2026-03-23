import Featured from "@/components/Featured";
import Carousel from "@/components/Carousel";
import LastSongs from "@/components/blocks/Last";
import TopSongs from "@/components/blocks/Top";
import NextSongs from "@/components/blocks/Next";
import MiniStats from "@/components/blocks/MiniStats";
import { lastSongs, nextSongs, topSongs } from "@/actions/songs";
import { slides as images } from "@/config";

export default async function Home() {
  // Buscar músicas do gênero "geral" por padrão (SSR)
  const last = (await lastSongs("geral")) ?? [];
  const top = (await topSongs()) ?? [];
  const { upcoming: next = [], nextIfNoRequests = null } =
    (await nextSongs("geral")) ?? {};

  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-7xl mx-auto px-4 lg:px-6">
      <section className="w-full mb-3">
        <Carousel images={images} autoplay={true} interval={5000} />
      </section>

      <section className="w-full mb-3">
        <iframe
          className="w-full aspect-video rounded min-h-80 border-2 border-primary/20"
          src="https://irc.somdomato.com"
          title="Bate-Papo - Rádio Som do Mato"
          allowFullScreen
        />
      </section>

      <section className="w-full mb-3">
        <Featured />
      </section>

      <section className="w-full mb-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <LastSongs data={last} />
          <TopSongs data={top} />
          <NextSongs data={next} initialNextIfNoRequests={nextIfNoRequests} />
        </div>
      </section>

      <section className="w-full mb-3">
        <MiniStats />
      </section>
    </div>
  );
}
