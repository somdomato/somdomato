import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adminLogs, users } from "@/db/schema";
import { desc, like, and, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const offset = (page - 1) * limit;
  const actionFilter = searchParams.get("action") || "";
  const search = searchParams.get("search") || "";

  try {
    const conditions = [];
    if (actionFilter) {
      conditions.push(like(adminLogs.action, `${actionFilter}%`));
    }
    if (search) {
      conditions.push(like(adminLogs.details, `%${search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      db
        .select({
          id: adminLogs.id,
          userId: adminLogs.userId,
          action: adminLogs.action,
          details: adminLogs.details,
          targetType: adminLogs.targetType,
          targetId: adminLogs.targetId,
          ip: adminLogs.ip,
          createdAt: adminLogs.createdAt,
        })
        .from(adminLogs)
        .where(where)
        .orderBy(desc(adminLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ id: adminLogs.id }).from(adminLogs).where(where),
    ]);

    // Fetch user names for logs that have userId
    const userIds = [
      ...new Set(items.map((i) => i.userId).filter(Boolean)),
    ] as number[];
    const userMap = new Map<number, string>();
    if (userIds.length > 0) {
      const userRows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const row of userRows) {
        userMap.set(row.id, row.name);
      }
    }

    const total = countResult.length;

    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        details: item.details ? JSON.parse(item.details) : null,
        userName: item.userId ? userMap.get(item.userId) || null : null,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching admin logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
}
