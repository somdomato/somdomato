import { addRequest } from "@/actions/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { songId } = body;

    if (!songId)
      return new Response(JSON.stringify({ error: "songId required" }), {
        status: 400,
      });

    // addRequest uses server-side cookie-based auth (verifyAuth), so just forward songId
    await addRequest(Number(songId));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("/api/admin/request error:", error);
    if (
      error instanceof Error &&
      (error.message === "Senha inválida" ||
        error.message === "Configuração de admin ausente")
    ) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 401,
      });
    }
    return new Response(JSON.stringify({ error: "failed" }), { status: 500 });
  }
}
