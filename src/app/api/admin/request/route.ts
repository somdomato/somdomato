import { addRequest } from "@/actions/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { songId, password } = body;

    if (!songId) return new Response(JSON.stringify({ error: "songId required" }), { status: 400 });

    await addRequest(Number(songId), String(password || ""));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("/api/admin/request error:", error);
    return new Response(JSON.stringify({ error: "failed" }), { status: 500 });
  }
}
