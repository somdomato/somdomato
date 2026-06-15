import { recoverSongCover } from "@/actions/admin";

export async function POST(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const p = await (context.params as
      | Promise<{ id: string }>
      | { id: string });
    const id = Number(p.id);

    const result = await recoverSongCover(id);
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error("/api/admin/songs/[id]/recover-cover error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "internal", message }), {
      status: 500,
    });
  }
}
