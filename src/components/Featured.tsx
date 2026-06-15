import Link from "next/link";
import { Music2, Users, BarChart3, Radio } from "lucide-react";

export default function Featured() {
  return (
    <div className="rounded-xl bg-background-alt border-2 border-primary/20 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Esquerda: tagline + CTA principal */}
        <div className="p-6 flex flex-col justify-center gap-4 border-b-2 md:border-b-0 md:border-r-2 border-black/30">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/20 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-3">
              <Radio className="w-3.5 h-3.5" />
              No ar 24h por dia
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight m-0">
              A Rádio Som do Mato
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mt-2">
              Sertanejo, gaúcha, arrocha e muito mais. Você escolhe a música,
              nós tocamos ao vivo pra você.
            </p>
          </div>
          <Link
            href="/pedidos"
            className="inline-flex items-center gap-2 bg-primary font-semibold text-sm px-5 py-2.5 rounded-lg transition-all active:scale-95 self-start shadow-md"
          >
            <Music2 className="w-4 h-4" />
            Peça sua música
          </Link>
        </div>

        {/* Direita: cards de ação rápida */}
        <div className="grid grid-cols-2 gap-px bg-black/30">
          <Link
            href="/artistas"
            className="flex flex-col items-center justify-center gap-2 p-5 bg-background-alt hover:bg-primary/10 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-sm text-white">Artistas</span>
            <span className="text-xs text-slate-400 text-center leading-tight">
              Explore o catálogo completo
            </span>
          </Link>

          <Link
            href="/pedidos"
            className="flex flex-col items-center justify-center gap-2 p-5 bg-background-alt hover:bg-primary/10 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
              <Music2 className="w-5 h-5 text-amber-400" />
            </div>
            <span className="font-semibold text-sm text-white">Pedidos</span>
            <span className="text-xs text-slate-400 text-center leading-tight">
              Fila ao vivo de músicas
            </span>
          </Link>

          <Link
            href="/estatisticas"
            className="flex flex-col items-center justify-center gap-2 p-5 bg-background-alt hover:bg-primary/10 transition-colors group border-t border-black/30"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-semibold text-sm text-white">
              Estatísticas
            </span>
            <span className="text-xs text-slate-400 text-center leading-tight">
              Números e tendências
            </span>
          </Link>

          <div className="flex flex-col items-center justify-center gap-2 p-5 bg-background-alt border-t border-black/30">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="font-semibold text-sm text-white">5 Estações</span>
            <span className="text-xs text-slate-400 text-center leading-tight">
              Geral, Gaúcha, Modão e mais
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
