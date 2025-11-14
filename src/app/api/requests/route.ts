import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { requests, songs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { checkMusicRepetition } from "@/lib/protections";

export async function GET() {
  try {
    const allRequests = await db.select().from(requests).orderBy(requests.id);

    const detailedRequests = await Promise.all(
      allRequests.map(async (request) => {
        const [song] = await db
          .select()
          .from(songs)
          .where(eq(songs.id, request.songId))
          .limit(1);

        return {
          ...request,
          song: {
            title: song?.title,
            artist: song?.artist,
            cover: song?.cover,
          },
        };
      }),
    );

    return NextResponse.json({ requests: detailedRequests }, { status: 200 });
  } catch (error) {
    console.error("Error fetching requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { songId } = body;
    const id = Number(songId);

    if (!id || Number.isNaN(id) || id <= 0) {
      return NextResponse.json(
        { error: "Song ID is required" },
        { status: 400 },
      );
    }

    const repetitionCheck = await checkMusicRepetition(id);

    if (repetitionCheck.isRepeated) {
      return NextResponse.json(
        {
          error:
            repetitionCheck.reason === "song_in_history"
              ? "Música já tocou recentemente"
              : repetitionCheck.reason === "song_in_requests"
                ? "Música já está nos pedidos"
                : "Artista tocou recentemente",
          message: repetitionCheck.message,
        },
        { status: 409 },
      );
    }

    // Buscar informações da música para resposta
    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);

    // Se passou por todas as verificações, criar o pedido
    const [newRequest] = await db
      .insert(requests)
      .values({ songId: id })
      .returning();

    await db
      .update(songs)
      .set({
        likes: sql`${songs.likes} + 1`,
        requests: sql`${songs.requests} + 1`,
      })
      .where(eq(songs.id, id));

    // Emit socket event para atualizar o admin e a página principal
    // emitToRoom("admin", "request-created", newRequest[0]);
    // emitToRoom("main", "requests-updated", {});

    if (global.io) {
      global.io.emit("request:added", newRequest);
    } else {
      console.warn("No socket.io server available: cannot emit request:added event");
    }

    return NextResponse.json(
      {
        message: "Pedido criado com sucesso",
        request: newRequest,
        song: {
          title: song?.title,
          artist: song?.artist,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating song request:", error);
    return NextResponse.json(
      { error: "Falha ao criar pedido de música" },
      { status: 500 },
    );
  }
}
