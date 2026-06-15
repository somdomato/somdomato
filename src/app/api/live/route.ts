import { getLiveState } from "@/lib/live";

export async function GET() {
  return Response.json(getLiveState());
}
