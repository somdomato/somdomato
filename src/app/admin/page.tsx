import { sql } from "drizzle-orm";
import { db } from "@/db";
import { songs, history, requests } from "@/db/schema";

const PAGE_SIZE = 10;

async function getRequests(page: number) {
  const offset = (page - 1) * PAGE_SIZE;
  const data = await db
    .select()
    .from(requests)
    .orderBy(requests.id)
    .limit(PAGE_SIZE)
    .offset(offset);
  const [{ count }] = await db
    .select({ count: sql`count(*)` })
    .from(requests);
  return { data, total: Number(count) };
}

async function getHistory(page: number) {
  const offset = (page - 1) * PAGE_SIZE;
  const data = await db
    .select()
    .from(history)
    .orderBy(history.id)
    .limit(PAGE_SIZE)
    .offset(offset);
  const [{ count }] = await db
    .select({ count: sql`count(*)` })
    .from(history);
  return { data, total: Number(count) };
}

async function getSongs(page: number) {
  const offset = (page - 1) * PAGE_SIZE;
  const data = await db
    .select()
    .from(songs)
    .orderBy(songs.id)
    .limit(PAGE_SIZE)
    .offset(offset);
  const [{ count }] = await db
    .select({ count: sql`count(*)` })
    .from(songs);
  return { data, total: Number(count) };
}

//export default async function AdminPanel({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
export default async function AdminPanel({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;

  const page = Number(params?.page) || 1;
  const historyPage = Number(params?.historyPage) || 1;
  const requestsPage = Number(params?.requestsPage) || 1;
  const { data: musicList, total } = await getSongs(page);
  const { data: historyList, total: historyTotal } = await getHistory(historyPage);
  const { data: requestsList, total: requestsTotal } = await getRequests(requestsPage);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const historyTotalPages = Math.ceil(historyTotal / PAGE_SIZE);
  const requestsTotalPages = Math.ceil(requestsTotal / PAGE_SIZE);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Painel de Administração</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">Músicas</h2>
          <ul className="mb-4">
            {musicList.map((song) => (
              <li key={song.id} className="border-b py-2">
                <span className="font-medium">{song.title}</span> — <span>{song.artist}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <a
              href={`?page=${page - 1}`}
              className={`px-2 py-1 rounded ${page <= 1 ? "opacity-50 pointer-events-none" : "bg-gray-200 hover:bg-gray-300"}`}
            >
              Anterior
            </a>
            <span className="px-2 py-1">Página {page} de {totalPages}</span>
            <a
              href={`?page=${page + 1}`}
              className={`px-2 py-1 rounded ${page >= totalPages ? "opacity-50 pointer-events-none" : "bg-gray-200 hover:bg-gray-300"}`}
            >
              Próxima
            </a>
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">Histórico</h2>
          <ul className="mb-4">
            {historyList.map((item) => (
              <li key={item.id} className="border-b py-2">
                <span className="font-medium">ID: {item.id}</span> — <span>Song ID: {item.songId}</span> — <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <a
              href={`?historyPage=${historyPage - 1}${page ? `&page=${page}` : ""}`}
              className={`px-2 py-1 rounded ${historyPage <= 1 ? "opacity-50 pointer-events-none" : "bg-gray-200 hover:bg-gray-300"}`}
            >
              Anterior
            </a>
            <span className="px-2 py-1">Página {historyPage} de {historyTotalPages}</span>
            <a
              href={`?historyPage=${historyPage + 1}${page ? `&page=${page}` : ""}`}
              className={`px-2 py-1 rounded ${historyPage >= historyTotalPages ? "opacity-50 pointer-events-none" : "bg-gray-200 hover:bg-gray-300"}`}
            >
              Próxima
            </a>
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">Pedidos</h2>
          <ul className="mb-4">
            {requestsList.map((item) => (
              <li key={item.id} className="border-b py-2">
                <span className="font-medium">ID: {item.id}</span> — <span>Song ID: {item.songId}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <a
              href={`?requestsPage=${requestsPage - 1}${page ? `&page=${page}` : ""}${historyPage ? `&historyPage=${historyPage}` : ""}`}
              className={`px-2 py-1 rounded ${requestsPage <= 1 ? "opacity-50 pointer-events-none" : "bg-gray-200 hover:bg-gray-300"}`}
            >
              Anterior
            </a>
            <span className="px-2 py-1">Página {requestsPage} de {requestsTotalPages}</span>
            <a
              href={`?requestsPage=${requestsPage + 1}${page ? `&page=${page}` : ""}${historyPage ? `&historyPage=${historyPage}` : ""}`}
              className={`px-2 py-1 rounded ${requestsPage >= requestsTotalPages ? "opacity-50 pointer-events-none" : "bg-gray-200 hover:bg-gray-300"}`}
            >
              Próxima
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
