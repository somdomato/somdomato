import React from "react";
import { db } from "@/db";
import { songs, history, requests } from "@/db/schema";
import { desc, eq, asc } from "drizzle-orm";
import { getNextSongToPlay } from "@/lib/rotation";
import HomeSectionsClient from "@/components/HomeSectionsClient";

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

  // serialize data for client component
  const serialLatest = latest.map((s) => ({ id: s.id, title: s.title, artist: s.artist, cover: s.cover || null, playedAt: s.playedAt ? Number(s.playedAt) : null }));
  const serialTop = top.map((t) => ({ id: t.id, title: t.title, artist: t.artist, cover: t.cover || null, count: t.count }));
  const serialUpcoming = upcoming.map((u) => ({ reqId: u.reqId, id: u.id, title: u.title, artist: u.artist, cover: u.cover || null, requestedAt: u.requestedAt ? Number(u.requestedAt) : null }));
  const serialNext = nextIfNoRequests ? { reqId: -1, id: nextIfNoRequests.id, title: nextIfNoRequests.title, artist: nextIfNoRequests.artist, cover: nextIfNoRequests.cover || null, requestedAt: nextIfNoRequests.createdAt ? Number(nextIfNoRequests.createdAt) : null } : null;

  return (
    <React.Fragment>
      {/* client component will subscribe to socket events and update in realtime */}
      <script></script>
      {/* @ts-ignore Server Component -> Client Component props serialization */}
      <HomeSectionsClient initialLatest={serialLatest} initialTop={serialTop} initialUpcoming={serialUpcoming} initialNextIfNoRequests={serialNext} />
    </React.Fragment>
  );
}
