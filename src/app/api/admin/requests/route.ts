import { getRequests } from "@/actions/admin";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Number(url.searchParams.get("limit") || "25");

    const data = await getRequests(page, limit);
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    console.error("/api/admin/requests error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}
