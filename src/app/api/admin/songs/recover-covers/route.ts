import { recoverCovers } from "@/actions/admin";

export async function POST() {
  try {
    const result = await recoverCovers();
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error("/api/admin/songs/recover-covers error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "internal", message }), {
      status: 500,
    });
  }
}
