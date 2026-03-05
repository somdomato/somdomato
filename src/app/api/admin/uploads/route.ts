import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "pending";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * limit;

  try {
    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(uploads)
        .where(eq(uploads.status, status))
        .orderBy(desc(uploads.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: uploads.id })
        .from(uploads)
        .where(eq(uploads.status, status)),
    ]);

    const total = countResult.length;

    return NextResponse.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching uploads:", error);
    return NextResponse.json(
      { error: "Failed to fetch uploads" },
      { status: 500 },
    );
  }
}
