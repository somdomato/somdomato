import Link from "next/link";
import {
  getSongs,
  getRequests,
  getHistory,
  getTopPlayed,
} from "@/app/admin/utils";

export default async function AdminIndex() {
  const { total: songsCount } = await getSongs(1);
  const { total: requestsCount } = await getRequests(1);
  const { total: historyCount } = await getHistory(1);
  const topPlayed = await getTopPlayed(5);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Painel de Administração</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/admin/musicas"
          className="block p-4 rounded bg-black text-white border-2 border-[#6b4f3a] hover:bg-green-700"
        >
          <h2 className="font-semibold">Músicas</h2>
          <p className="text-sm text-muted">Total: {songsCount}</p>
          <p className="mt-2 text-xs text-gray-600">
            Gerencie músicas, editar tags e renomear arquivos.
          </p>
        </Link>

        <Link
          href="/admin/pedidos"
          className="block p-4 rounded bg-black text-white border-2 border-[#6b4f3a] hover:bg-green-700"
        >
          <h2 className="font-semibold">Pedidos</h2>
          <p className="text-sm text-muted">Total: {requestsCount}</p>
          <p className="mt-2 text-xs text-gray-600">
            Veja e gerencie pedidos de ouvintes.
          </p>
        </Link>

        <Link
          href="/admin/historico"
          className="block p-4 rounded bg-black text-white border-2 border-[#6b4f3a] hover:bg-green-700"
        >
          <h2 className="font-semibold">Histórico</h2>
          <p className="text-sm text-muted">Total: {historyCount}</p>
          <p className="mt-2 text-xs text-gray-600">
            Veja o histórico de músicas tocadas.
          </p>
        </Link>

        <Link
          href="/admin/estatisticas"
          className="block p-4 rounded bg-black text-white border-2 border-[#6b4f3a] hover:bg-green-700"
        >
          <h2 className="font-semibold">Estatísticas</h2>
          <p className="text-sm text-muted">Top: {topPlayed.length}</p>
          <p className="mt-2 text-xs text-gray-600">
            Visão geral e top por reproduções.
          </p>
        </Link>
      </div>
    </main>
  );
}
