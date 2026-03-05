import { type NextRequest, NextResponse } from "next/server";
import { trackPageView } from "@/actions/stats";

/**
 * POST /api/stats/track
 * Registra uma visualização de página
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { page, sessionId } = body;

    if (!page) {
      return NextResponse.json(
        { error: "Página é obrigatória" },
        { status: 400 },
      );
    }

    // Obter IP do request
    const forwarded = request.headers.get("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Obter User Agent
    const userAgent = request.headers.get("user-agent") || undefined;

    const result = await trackPageView(page, ip, userAgent, sessionId);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error("Erro ao processar tracking:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
