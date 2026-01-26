import { getAllSongsForSelect } from "@/actions/admin";

export async function GET() {
  try {
    const data = await getAllSongsForSelect();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    console.error("/api/admin/songs/select error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}
