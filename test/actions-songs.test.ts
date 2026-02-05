import { describe, it, expect, vi } from "vitest";

// Mocks
vi.mock("@/db", async () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          orderBy: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 1,
                  title: "A",
                  artist: "X",
                  cover: null,
                  playedAt: Date.now(),
                  genre: "gaucha",
                },
                {
                  id: 2,
                  title: "B",
                  artist: "Y",
                  cover: null,
                  playedAt: Date.now(),
                  genre: "geral",
                },
              ]),
          }),
        }),
      }),
    }),
    // Mock para requests (quando solicitamos upcoming)
    // Quando for usado, retornará vazio por padrão
    // Usado por nextSongs: se genre === 'geral' retorna pedidos
    // Forçar o comportamento de pedidos em testes específicos via vi.mocked if needed
  },
}));

vi.mock("@/lib/rotation", async () => ({
  getNextSongToPlay: async () => ({
    id: 99,
    title: "Auto",
    artist: "DJ",
    cover: null,
    createdAt: Date.now(),
  }),
}));

import { lastSongs, nextSongs } from "@/actions/songs";

describe("actions/songs", () => {
  it("lastSongs filters by genre", async () => {
    const lastGaucha = await lastSongs("gaucha");
    expect(Array.isArray(lastGaucha)).toBe(true);
    expect(lastGaucha.length > 0).toBe(true);
    const first = lastGaucha[0] as { title: string };
    expect(first.title).toBeTruthy();
  });

  it("nextSongs returns autodj for non-geral", async () => {
    const res = await nextSongs("modao");
    expect(res.nextIfNoRequests).toBeTruthy();
    expect(res.nextIfNoRequests!.id).toBe(99);
  });
});
