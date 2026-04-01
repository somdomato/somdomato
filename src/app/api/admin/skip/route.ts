import { logAction } from "@/lib/logging";

export async function POST() {
  try {
    // Call the public endpoint that selects the next song and emits song:changed
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/music?notify=true`);
    if (!res.ok) {
      const text = await res.text();
      console.error("/api/music returned error:", text);
      return new Response(JSON.stringify({ error: "failed to select next" }), {
        status: 500,
      });
    }

    const json = await res.json();

    await logAction({
      action: "admin:skip",
      details: { nextSong: json?.title, nextArtist: json?.artist },
    });

    // Try to trigger Liquidsoap to fetch next/skip immediately, if control URL provided
    const controlUrl = process.env.LIQUIDSOAP_CONTROL_URL;
    if (controlUrl) {
      try {
        await fetch(`${controlUrl}/skip`, { method: "POST" }).catch((e) =>
          console.error("liquidsoap skip call failed", e),
        );
      } catch (err) {
        console.error("Error calling liquidsoap control endpoint:", err);
      }
    }

    return new Response(JSON.stringify({ success: true, music: json }), {
      status: 200,
    });
  } catch (error) {
    console.error("/api/admin/skip error:", error);
    const message = error instanceof Error ? error.message : "failed";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
