import { nextSongs } from "@/actions/songs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const genre = url.searchParams.get("genre") || undefined;

    const data = await nextSongs(genre);
    return Response.json(data);
  } catch (err) {
    console.error("/api/songs/next error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
