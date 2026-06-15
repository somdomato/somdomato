import Link from "next/link";
import {
  ArrowRight,
  Check,
  Download,
  ListMusic,
  Music2,
  Radio,
  Search,
  Sparkles,
} from "lucide-react";

const requestSteps = [
  {
    icon: Search,
    title: "Encontre a música",
    description: "Pesquise no catálogo da rádio pelo nome da música ou artista.",
  },
  {
    icon: Download,
    title: "Não encontrou? Tudo bem",
    description: "Digite o nome e a rádio busca e adiciona a música automaticamente.",
  },
  {
    icon: ListMusic,
    title: "Ela entra na fila",
    description: "Seu pedido é confirmado e toca em seguida na programação ao vivo.",
  },
];

export default function Featured() {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-primary/25 bg-background-alt shadow-xl shadow-black/20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl"
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[0.95fr_1.35fr]">
        <div className="flex flex-col justify-center gap-5 border-b-2 border-black/30 p-6 sm:p-8 lg:border-b-0 lg:border-r-2 lg:p-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Você escolhe. A rádio toca.
            </div>

            <h2 className="m-0 max-w-xl text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
              Peça sua música e ouça ela tocar em seguida
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Escolha uma música do nosso catálogo. Se ela ainda não estiver na
              rádio, basta digitar o nome: o sistema busca, adiciona e coloca seu
              pedido na fila automaticamente.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" />
              Pedido simples e rápido
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" />
              Catálogo ampliado automaticamente
            </span>
          </div>

          <Link
            href="/pedidos"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-sm shadow-lg shadow-primary/15 transition-all hover:brightness-110 active:scale-[0.98] sm:w-fit"
          >
            <Music2 className="h-4 w-4" />
            Pedir uma música agora
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="flex flex-col justify-center gap-5 p-5 sm:p-7 lg:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Como funciona
              </p>
              <h3 className="m-0 mt-1 text-lg font-bold text-white sm:text-xl">
                Do pedido ao ar em três passos
              </h3>
            </div>

            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/15 sm:flex">
              <Radio className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {requestSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.title}
                  className="group relative rounded-xl border border-white/10 bg-black/20 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 transition-colors group-hover:bg-primary/25">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-2xl font-black text-white/10">
                      0{index + 1}
                    </span>
                  </div>

                  <h4 className="m-0 text-sm font-semibold text-white">
                    {step.title}
                  </h4>
                  <p className="m-0 mt-1.5 text-xs leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/15">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            </div>
            <p className="m-0 text-xs leading-relaxed text-amber-100/80 sm:text-sm">
              Até uma música que ainda não existe na rádio pode virar seu próximo
              pedido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
