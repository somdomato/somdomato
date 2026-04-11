import { getLiveState, setLive } from "@/lib/live";
import { verifyAuth } from "@/actions/admin";
import { logAction } from "@/lib/logging";

export async function GET() {
  return Response.json(getLiveState());
}

export async function POST(request: Request) {
  const session = await verifyAuth();

  const body = await request.json();
  const active = Boolean(body.live);
  const djName = typeof body.djName === "string" ? body.djName.trim() : "";

  setLive(active, djName);

  const state = getLiveState();

  // Emitir via Socket.io para todos os clientes
  if (global.io) {
    global.io.emit("live:changed", state);
  }

  await logAction({
    action: active ? "admin:live_on" : "admin:live_off",
    details: { djName: state.djName },
    userId: session.id,
  });

  return Response.json(state);
}
