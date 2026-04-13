import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const interval = Number(body.interval);

    if (!interval || interval < 1 || interval > 100) {
      return Response.json(
        { error: "Intervalo deve ser entre 1 e 100" },
        { status: 400 },
      );
    }

    // Upsert: insert or update
    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "jingle_interval"))
      .get();

    if (existing) {
      await db
        .update(settings)
        .set({ value: String(interval) })
        .where(eq(settings.key, "jingle_interval"));
    } else {
      await db.insert(settings).values({
        key: "jingle_interval",
        value: String(interval),
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("/api/admin/jingles/settings POST error:", err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
