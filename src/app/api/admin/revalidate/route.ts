import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

const allowedPaths = [
  "/",
  "/admin",
  "/admin/musicas",
  "/admin/pedidos",
  "/admin/historico",
  "/admin/estatisticas",
  "/pedidos",
  "/top10",
  "/historico",
];

export async function POST(request: Request) {
  const authResp = requireAdmin(request);
  if (authResp) return authResp;
  try {
    const body = await request.json();
    const { paths } = body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ error: "paths is required" }, { status: 400 });
    }
    const results: Record<string, { ok: boolean; error?: string }> = {};
    for (const p of paths) {
      if (!allowedPaths.includes(p)) {
        results[p] = { ok: false, error: "path not allowed" };
        continue;
      }
      try {
        await revalidatePath(p);
        results[p] = { ok: true };
      } catch (err) {
        results[p] = { ok: false, error: (err as Error).message };
      }
    }
    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("Error in revalidate endpoint:", err);
    return NextResponse.json(
      { error: "Failed to revalidate" },
      { status: 500 },
    );
  }
}
