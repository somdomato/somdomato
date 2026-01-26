import Image from "next/image";
import Link from "next/link";
import { db } from "@/db";
import { songs, history, requests } from "@/db/schema";
import { desc, eq, asc } from "drizzle-orm";
import { getNextSongToPlay } from "@/lib/rotation";

type TopEntry = { id: number; title: string; artist: string; cover: string | null; count: number };

export default async function HomeSections() {
  // Últimas 10 músicas
  const latest = await db.select({ id: songs.id, title: songs.title, artist: songs.artist, cover: songs.cover, playedAt: history.createdAt }).from(history).innerJoin(songs, eq(history.songId, songs.id)).orderBy(desc(history.id)).limit(10);

  // Top 10 (agregação em memória a partir do histórico)
  const allHistory = await db.select({ id: songs.id, title: songs.title, artist: songs.artist, cover: songs.cover }).from(history).innerJoin(songs, eq(history.songId, songs.id));

  const map = new Map<number, TopEntry>();
  for (const row of allHistory) {
    const entry = map.get(row.id);
    if (entry) entry.count += 1;
    else map.set(row.id, { id: row.id, title: row.title, artist: row.artist, cover: row.cover || null, count: 1 });
  }

  const top = Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Próximas: pedidos pendentes (se existirem)
  const upcoming = await db.select({ reqId: requests.id, id: songs.id, title: songs.title, artist: songs.artist, cover: songs.cover, requestedAt: requests.createdAt }).from(requests).innerJoin(songs, eq(requests.songId, songs.id)).orderBy(asc(requests.order), asc(requests.createdAt)).limit(10);

  const nextIfNoRequests = upcoming.length === 0 ? await getNextSongToPlay() : null;

  return (
    <section className="mt-6 max-w-4xl mx-auto w-full px-2 md:px-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-background-alt border border-primary/20 rounded p-3">
          <h3 className="font-semibold mb-3">Últimas</h3>
          <ul className="space-y-2 text-sm">
            {latest.length === 0 ? (
              <li className="text-muted">Nenhuma música tocada ainda.</li>
            ) : (
              latest.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <Image src={s.cover || "/images/logotipo.svg"} width={36} height={36} alt={s.title} className="rounded" />
                  <div className="flex-1">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted">{s.artist}</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-background-alt border border-primary/20 rounded p-3">
          <h3 className="font-semibold mb-3">TOP 10</h3>
          <ul className="space-y-2 text-sm">
            {top.length === 0 ? (
              <li className="text-muted">Sem dados de reprodução.</li>
            ) : (
              top.map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <Image src={t.cover || "/images/logotipo.svg"} width={36} height={36} alt={t.title} className="rounded" />
                  <div className="flex-1">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted">
                      {t.artist} • {t.count}x
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-background-alt border border-primary/20 rounded p-3">
          <h3 className="font-semibold mb-3">Próximas</h3>
          <ul className="space-y-2 text-sm">
            {upcoming.length === 0 ? (
              nextIfNoRequests ? (
                <li className="flex items-center gap-3">
                  <Image src={nextIfNoRequests.cover || "/images/logotipo.svg"} width={36} height={36} alt={nextIfNoRequests.title} className="rounded" />
                  <div className="flex-1">
                    <div className="font-medium">{nextIfNoRequests.title}</div>
                    <div className="text-xs text-muted">{nextIfNoRequests.artist} • selecionada pelo AutoDJ</div>
                  </div>
                </li>
              ) : (
                <li className="text-muted">Sem pedidos pendentes.</li>
              )
            ) : (
              upcoming.map((u) => (
                <li key={u.reqId} className="flex items-center gap-3">
                  <Image src={u.cover || "/images/logotipo.svg"} width={36} height={36} alt={u.title} className="rounded" />
                  <div className="flex-1">
                    <div className="font-medium">{u.title}</div>
                    <div className="text-xs text-muted">{u.artist}</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-3 text-right text-xs text-muted">
        <Link href="/pedidos" className="underline">
          Ver todos os pedidos
        </Link>
      </div>
    </section>
  );
}
