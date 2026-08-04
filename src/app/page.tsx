import { Suspense } from "react";
import ChatEmbed from "@/components/ChatEmbed";
//import Featured from "@/components/Featured";
//import Carousel from "@/components/Carousel";
import SongsSection from "@/components/blocks/SongsSection";
//import MiniStats from "@/components/blocks/MiniStats";
//import { slides as images } from "@/config";

// Dados vêm do banco de produção ao vivo (fila/histórico mudam a cada
// música) — nunca deve ser pré-renderizada/cacheada como estática, e não
// deve rodar contra o banco durante o build.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 lg:px-6 py-4 gap-5">
      {/* Hero: Carousel com controles */}
      {/*<section className="w-full">
        <Carousel
          images={images}
          autoplay={true}
          interval={5000}
          showControls={true}
        />
      </section>*/}

      {/* Destaque: info + CTAs */}
      {/* <section className="w-full">
        <Featured />
      </section> */}

      {/* Chat */}
      <section className="w-full">
        <div className="bg-background-alt border-2 border-primary/20 rounded-xl pt-4 pb-0 md:pt-4 md:pb-4 h-full flex flex-col">
          <div className="px-2 md:px-4 h-full flex flex-col">
            <h3 className="flex items-center gap-2 font-semibold text-base mb-3 m-0 pb-2.5 border-b border-black/30">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20">
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
              </span>
              Bate-Papo
            </h3>
          </div>
          <div className="px-0 md:px-4 h-full flex flex-col">
            <ChatEmbed />
          </div>
        </div>
      </section>

      {/* Conteúdo principal: últimas, top e próximas */}
      <section className="w-full">
        <Suspense
          fallback={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                  key={i}
                  className="h-48 rounded-xl bg-background-alt border-2 border-primary/20 animate-pulse"
                />
              ))}
            </div>
          }
        >
          <SongsSection />
        </Suspense>
      </section>
    </div>
  );
}
