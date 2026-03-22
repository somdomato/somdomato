import { NextRequest, NextResponse } from "next/server";

interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  artist: { name: string };
  album: { title: string; cover_medium: string; cover_small: string };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const url = new URL("https://api.deezer.com/search");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "10");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("Deezer API error:", data);
      return NextResponse.json(
        { error: "Failed to search Deezer" },
        { status: 500 },
      );
    }

    const results =
      data.data?.map((item: DeezerTrack) => ({
        id: String(item.id),
        title: item.title,
        artist: item.artist.name,
        thumbnail: item.album.cover_medium || item.album.cover_small,
        duration: item.duration || 0,
      })) || [];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search Deezer" },
      { status: 500 },
    );
  }
}
