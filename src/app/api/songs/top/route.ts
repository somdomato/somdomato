import { topSongs } from "@/actions/songs";

export async function GET() {
  try {
    const data = await topSongs();
    return Response.json(data);
  } catch (err) {
    console.error("/api/songs/top error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
