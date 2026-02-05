import { reorderRequests } from "@/actions/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestId, newOrder } = body;

    if (!requestId || newOrder === undefined)
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
      });

    await reorderRequests(Number(requestId), Number(newOrder));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("/api/admin/reorder error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "internal", message }), {
      status: 500,
    });
  }
}
