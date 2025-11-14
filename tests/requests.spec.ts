import { describe, it, expect, beforeEach, afterEach } from "bun:test";

import * as actions from "@/actions/song";
import * as dbModule from "@/db";
// avoid importing protections directly to prevent read-only binding issues
import { POST } from "@/app/api/requests/route";
import type { NextRequest } from "next/server";

describe("requests realtime", () => {
  // no-op placeholder, removed protections override to avoid ESM binding issues
  let origIo: PropertyDescriptor | undefined;
  let calls: Array<{ evt: string; payload: Record<string, unknown> }>;
  let origDbInsert: unknown;
  let origDbUpdate: unknown;
  let origDbSelect: unknown;

  beforeEach(() => {
    // No rewrite of exported module functions: instead we'll stub `db` calls
    // so that checkMusicRepetition resolves with `isRepeated: false`.

    // stub global.socket
    calls = [];
    origIo = Object.getOwnPropertyDescriptor(globalThis, "io");
    Object.defineProperty(globalThis, "io", {
      configurable: true,
      value: {
        emit: (evt: string, payload: Record<string, unknown>) =>
          calls.push({ evt, payload }),
      },
    });

    // stub DB operations used by RequestSong and POST
    // Save original descriptors so we can restore them later.
    origDbInsert = Object.getOwnPropertyDescriptor(dbModule.db, "insert");
    origDbUpdate = Object.getOwnPropertyDescriptor(dbModule.db, "update");
    origDbSelect = Object.getOwnPropertyDescriptor(dbModule.db, "select");

    // Stub DB select to return a specific dataset based on call index so that
    // checkMusicRepetition passes all checks and RequestSong can proceed.
    let selectCallIdx = 0;
    Object.defineProperty(dbModule.db, "select", {
      configurable: true,
      value: () => {
        const call = selectCallIdx++;
        // Make a builder that supports the chain calls used by the app
        if (call === 4) {
          // pendingArtists case: no limit/ordering, innerJoin expected to
          // return an array directly
          return {
            from: () => ({ innerJoin: () => [] }),
          } as unknown;
        }

        return {
          from: () => ({
            where: () => ({
              limit: async () => {
                // 0: verify song exists -> return a song
                // Return a song for the first select (song exists check) and
                // again when the API re-fetches the song (after validations).
                if (call === 0 || call === 5)
                  return [
                    {
                      id: 999,
                      title: "Test Song",
                      artist: "Test Artist",
                      cover: null,
                    },
                  ];
                // all other `.limit` calls -> empty arrays
                return [];
              },
            }),
            orderBy: () => ({ limit: async () => [] }),
            innerJoin: () => ({ orderBy: () => ({ limit: async () => [] }) }),
          }),
          orderBy: () => ({ limit: async () => [] }),
          innerJoin: () => ({ orderBy: () => ({ limit: async () => [] }) }),
        } as unknown;
      },
    });

    Object.defineProperty(dbModule.db, "insert", {
      configurable: true,
      value: () => ({
        values: () => ({
          returning: async () => [{ id: 42, songId: 999 }],
        }),
      }),
    });

    Object.defineProperty(dbModule.db, "update", {
      configurable: true,
      value: () => ({ set: () => ({ where: async () => [] }) }),
    });

    // `select` stub above will be used by checkMusicRepetition to ensure no
    // conflicts; nothing else to do here.
  });

  afterEach(() => {
    // no protections restore step since we didn't override the exported function
    if (origIo) Object.defineProperty(globalThis, "io", origIo);
    if (origDbInsert)
      Object.defineProperty(dbModule.db, "insert", origDbInsert);
    if (origDbUpdate)
      Object.defineProperty(dbModule.db, "update", origDbUpdate);
    if (origDbSelect)
      Object.defineProperty(dbModule.db, "select", origDbSelect);
  });

  it("RequestSong emits request:added with payload", async () => {
    const result = await actions.RequestSong(999);
    expect(result.success).toBe(true);

    expect(calls.length).toBeGreaterThanOrEqual(1);
    const evt = calls.find((c) => c.evt === "request:added");
    expect(evt).toBeTruthy();
    if (!evt) throw new Error("Expected event");
    const payload = evt.payload as {
      request?: unknown;
      song?: { title?: string };
    };
    expect(payload.request).not.toBeUndefined();
    expect(payload.song?.title).toBe("Test Song");
  });

  it("API POST /api/requests emits request:added", async () => {
    const req = new Request("http://localhost/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId: 999 }),
    });

    const resp = await POST(req as unknown as NextRequest);
    const json = await resp.json();
    expect(json.request).toBeTruthy();
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const evt = calls.find((c) => c.evt === "request:added");
    expect(evt).toBeTruthy();
    if (!evt) throw new Error("Expected event");
    const payload2 = evt.payload as { song?: { title?: string } };
    expect(payload2.song?.title).toBe("Test Song");
  });
});
