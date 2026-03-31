import Featured from "@/components/Featured";
import Carousel from "@/components/Carousel";
import LastSongs from "@/components/blocks/Last";
import TopSongs from "@/components/blocks/Top";
import NextSongs from "@/components/blocks/Next";
import MiniStats from "@/components/blocks/MiniStats";
import { lastSongs, nextSongs, topSongs } from "@/actions/songs";
import { slides as images } from "@/config";

export default async function Home() {
  const last = (await lastSongs("geral")) ?? [];
  const top = (await topSongs()) ?? [];
  const { upcoming: next = [], nextIfNoRequests = null } =
    (await nextSongs("geral")) ?? {};

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 lg:px-6 py-4 gap-5">
      {/* Hero: Carousel com controles */}
      <section className="w-full">
        <Carousel
          images={images}
          autoplay={true}
          interval={5000}
          showControls={true}
        />
      </section>

      {/* Destaque: info + CTAs */}
      <section className="w-full">
        <Featured />
      </section>

      {/* Conteúdo principal: últimas, top e próximas */}
      <section className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LastSongs data={last} />
          <TopSongs data={top} />
          <NextSongs data={next} initialNextIfNoRequests={nextIfNoRequests} />
        </div>
      </section>

      {/* Chat + Estatísticas lado a lado */}
      <section className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white/80 m-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Bate-Papo
            </h3>
            <iframe
              className="w-full rounded-xl border-2 border-primary/20 h-72 lg:h-88"
              src="https://irc.somdomato.com"
              title="Bate-Papo - Rádio Som do Mato"
              allowFullScreen
            />
          </div>
          <div className="lg:col-span-2">
            <MiniStats />
          </div>
        </div>
      </section>
    </div>
  );
}
