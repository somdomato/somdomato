import { lastSongs } from "@/actions/songs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const genre = url.searchParams.get("genre") || undefined;
    
    const data = await lastSongs(genre);
    return Response.json(data);
  } catch (err) {
    console.error("/api/songs/last error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
