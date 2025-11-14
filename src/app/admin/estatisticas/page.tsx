import {
  getTopPlayed,
  getSongs,
  getHistory,
  getRequests,
} from "@/app/admin/utils";

export default async function EstatisticasPage() {
  const topPlayed = await getTopPlayed(5);
  const { total: songsTotal } = await getSongs(1);
  const { total: historyTotal } = await getHistory(1);
  const { total: requestsTotal } = await getRequests(1);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Estatísticas</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-background border-2 border-black/50 rounded-lg p-4">
          <h3 className="font-bold">Contagens</h3>
          <p>Músicas: {songsTotal}</p>
          <p>Histórico: {historyTotal}</p>
          <p>Pedidos: {requestsTotal}</p>
        </div>
        <div className="bg-background border-2 border-black/50 rounded-lg p-4 md:col-span-2">
          <h3 className="font-bold">Top 5 por reproduções</h3>
          <ul className="mt-2">
            {topPlayed.map((song) => (
              <li key={song.id} className="mb-1">
                <span className="font-medium">{song.title}</span> —{" "}
                <span className="text-sm text-gray-600">{song.artist}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
