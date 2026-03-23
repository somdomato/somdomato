import Link from "next/link";
import { getMiniStats } from "@/actions/stats";
import { BarChart3, Users, Eye, Clock } from "lucide-react";

export default async function MiniStats() {
  const stats = await getMiniStats();

  return (
    <div className="bg-background-alt border-2 border-primary/20 rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <span className="font-semibold">Estatísticas</span>
        </div>
        <Link
          href="/estatisticas"
          className="text-xs text-primary hover:text-white transition-colors"
        >
          Ver mais →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary/20">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Visitas</p>
            <p className="font-semibold">
              {stats.uniqueVisits.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-emerald-500/20">
            <Eye className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Cliques</p>
            <p className="font-semibold">
              {stats.totalClicks.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-500/20">
            <BarChart3 className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Hoje</p>
            <p className="font-semibold">
              {stats.visitsToday.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-amber-500/20">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Última hora</p>
            <p className="font-semibold">
              {stats.visitsLastHour.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
