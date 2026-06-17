import Link from "next/link";
import { getFullStats } from "@/actions/stats";
import {
  Music,
  ListOrdered,
  Upload,
  ScrollText,
  Users,
  Megaphone,
  BarChart3,
  Clock,
  Calendar,
  MousePointer,
  TrendingUp,
  Eye,
  Globe,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "primary" | "amber" | "emerald" | "blue";
}) {
  const colorClasses = {
    primary: "bg-primary/20 text-primary",
    amber: "bg-amber-500/20 text-amber-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/20 text-blue-400",
  };

  return (
    <div className="bg-background-alt border border-primary/20 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold">
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function PageClicksTable({
  clicksByPage,
}: {
  clicksByPage: Record<string, number>;
}) {
  const sortedPages = Object.entries(clicksByPage).sort((a, b) => b[1] - a[1]);

  const pageNames: Record<string, string> = {
    "/": "Página Inicial",
    "/pedidos": "Pedidos",
    "/artistas": "Artistas",
    "/estatisticas": "Estatísticas",
    "/admin": "Admin",
  };

  return (
    <div className="bg-background-alt border border-primary/20 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Cliques por Página</h3>
      </div>
      <div className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 text-gray-400 font-medium">
                Página
              </th>
              <th className="text-right py-2 text-gray-400 font-medium">
                Cliques
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPages.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center py-4 text-gray-500">
                  Nenhum dado ainda
                </td>
              </tr>
            ) : (
              sortedPages.map(([page, clicks]) => (
                <tr key={page} className="border-b border-white/5">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">{page}</span>
                      {pageNames[page] && (
                        <span className="text-white">{pageNames[page]}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right font-medium">
                    {clicks.toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function AdminEstatisticasPage() {
  const stats = await getFullStats();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background-alt border-b border-primary/30">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm hover:text-primary transition-colors"
            >
              Ver Site
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-background-alt border-b border-primary/30">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Music size={18} />
              <span className="hidden sm:inline">Músicas</span>
            </Link>
            <Link
              href="/admin/requests"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <ListOrdered size={18} />
              <span className="hidden sm:inline">Pedidos</span>
            </Link>
            <Link
              href="/admin/uploads"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Envios</span>
            </Link>
            <Link
              href="/admin/vinhetas"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Megaphone size={18} />
              <span className="hidden sm:inline">Vinhetas</span>
            </Link>
            <Link
              href="/admin/logs"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <ScrollText size={18} />
              <span className="hidden sm:inline">Logs</span>
            </Link>
            <Link
              href="/admin/usuarios"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Users size={18} />
              <span className="hidden sm:inline">Usuários</span>
            </Link>
            <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-primary text-primary whitespace-nowrap text-sm">
              <BarChart3 size={18} />
              <span className="hidden sm:inline">Estatísticas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Grid de Cards Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={MousePointer}
            title="Total de Cliques"
            value={stats.totalClicks}
            subtitle="Todas as páginas"
            color="primary"
          />
          <StatCard
            icon={Users}
            title="Visitas Únicas"
            value={stats.uniqueVisits}
            subtitle="IPs únicos"
            color="emerald"
          />
          <StatCard
            icon={Eye}
            title="Visitas Hoje"
            value={stats.visitsToday}
            subtitle="Desde meia-noite"
            color="blue"
          />
          <StatCard
            icon={Clock}
            title="Última Hora"
            value={stats.visitsLastHour}
            subtitle="Visitantes únicos"
            color="amber"
          />
        </div>

        {/* Seção de Médias */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={TrendingUp}
            title="Média por Hora"
            value={stats.avgVisitsPerHour}
            subtitle="Visitantes únicos"
            color="emerald"
          />
          <StatCard
            icon={Calendar}
            title="Média por Dia"
            value={stats.avgVisitsPerDay}
            subtitle="Visitantes únicos"
            color="blue"
          />
          <StatCard
            icon={BarChart3}
            title="Último Mês"
            value={stats.visitsLastMonth}
            subtitle={`Média: ${stats.avgVisitsPerMonth}/mês`}
            color="primary"
          />
        </div>

        {/* Tabela de Cliques por Página */}
        <PageClicksTable clicksByPage={stats.clicksByPage} />
      </main>
    </div>
  );
}
