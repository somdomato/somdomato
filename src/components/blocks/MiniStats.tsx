import Link from "next/link";
import { getMiniStats } from "@/actions/stats";
import { BarChart3, Users, Eye, Clock } from "lucide-react";

export default async function MiniStats() {
  const stats = await getMiniStats();

  return (
    <div className="bg-background-alt border-2 border-primary/20 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-black/30">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20">
            <BarChart3 className="w-4 h-4 text-primary" />
          </span>
          <span className="font-semibold text-base">Estatísticas</span>
        </div>
        <Link
          href="/estatisticas"
          className="text-xs text-primary hover:text-white transition-colors"
        >
          Ver mais →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        <div className="flex flex-col gap-1 rounded-lg bg-background/40 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="p-1 rounded bg-primary/20">
              <Users className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-xs text-gray-400">Visitas totais</p>
          </div>
          <p className="text-lg font-bold leading-none">
            {stats.uniqueVisits.toLocaleString("pt-BR")}
          </p>
        </div>

        <div className="flex flex-col gap-1 rounded-lg bg-background/40 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="p-1 rounded bg-emerald-500/20">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-xs text-gray-400">Cliques</p>
          </div>
          <p className="text-lg font-bold leading-none">
            {stats.totalClicks.toLocaleString("pt-BR")}
          </p>
        </div>

        <div className="flex flex-col gap-1 rounded-lg bg-background/40 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="p-1 rounded bg-blue-500/20">
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-xs text-gray-400">Hoje</p>
          </div>
          <p className="text-lg font-bold leading-none">
            {stats.visitsToday.toLocaleString("pt-BR")}
          </p>
        </div>

        <div className="flex flex-col gap-1 rounded-lg bg-background/40 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="p-1 rounded bg-amber-500/20">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-xs text-gray-400">Última hora</p>
          </div>
          <p className="text-lg font-bold leading-none">
            {stats.visitsLastHour.toLocaleString("pt-BR")}
          </p>
        </div>
      </div>
    </div>
  );
}
