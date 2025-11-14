import { findCoverByArtist } from "@/lib/cover";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist");
  if (!artist) {
    return Response.json(
      { error: "Parâmetro 'artist' obrigatório." },
      { status: 400 },
    );
  }

  try {
    const coverPath = await findCoverByArtist(artist);
    if (coverPath) {
      return Response.json({ cover: coverPath });
    } else {
      return Response.json(
        { cover: null, error: "Capa não encontrada." },
        { status: 404 },
      );
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
