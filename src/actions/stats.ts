"use server";

import { db } from "@/db";
import { pageViews } from "@/db/schema";
import { gte, count, countDistinct, sql } from "drizzle-orm";

export type ChartRange = "all" | "year" | "month" | "week" | "day" | "hour";

export type ChartPoint = {
  bucket: string;
  label: string;
  clicks: number;
  uniqueVisits: number;
};

export type StatsData = {
  totalClicks: number;
  uniqueVisits: number;
  clicksByPage: Record<string, number>;
  visitsLastHour: number;
  avgVisitsPerHour: number;
  visitsToday: number;
  avgVisitsPerDay: number;
  visitsLastMonth: number;
  avgVisitsPerMonth: number;
};

export type MiniStatsData = {
  totalClicks: number;
  uniqueVisits: number;
  visitsToday: number;
  visitsLastHour: number;
};

/**
 * Registra uma visualização de página
 */
export async function trackPageView(
  page: string,
  ip: string,
  userAgent?: string,
  sessionId?: string,
) {
  try {
    await db.insert(pageViews).values({
      page,
      ip,
      userAgent: userAgent || null,
      sessionId: sessionId || null,
    });
    return { success: true };
  } catch (error) {
    console.error("Erro ao registrar visualização:", error);
    return { success: false, error: "Falha ao registrar visualização" };
  }
}

/**
 * Obtém estatísticas completas do site
 */
export async function getFullStats(): Promise<StatsData> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Total de cliques
  const totalClicksResult = await db.select({ count: count() }).from(pageViews);
  const totalClicks = totalClicksResult[0]?.count || 0;

  // Visitas únicas (por IP)
  const uniqueVisitsResult = await db
    .select({ count: countDistinct(pageViews.ip) })
    .from(pageViews);
  const uniqueVisits = uniqueVisitsResult[0]?.count || 0;

  // Cliques por página
  const clicksByPageResult = await db
    .select({
      page: pageViews.page,
      count: count(),
    })
    .from(pageViews)
    .groupBy(pageViews.page);

  const clicksByPage: Record<string, number> = {};
  for (const row of clicksByPageResult) {
    clicksByPage[row.page] = row.count;
  }

  // Visitas na última hora (IPs únicos)
  const visitsLastHourResult = await db
    .select({ count: countDistinct(pageViews.ip) })
    .from(pageViews)
    .where(gte(pageViews.createdAt, oneHourAgo));
  const visitsLastHour = visitsLastHourResult[0]?.count || 0;

  // Visitas hoje (IPs únicos)
  const visitsTodayResult = await db
    .select({ count: countDistinct(pageViews.ip) })
    .from(pageViews)
    .where(gte(pageViews.createdAt, todayStart));
  const visitsToday = visitsTodayResult[0]?.count || 0;

  // Visitas no último mês (IPs únicos)
  const visitsLastMonthResult = await db
    .select({ count: countDistinct(pageViews.ip) })
    .from(pageViews)
    .where(gte(pageViews.createdAt, oneMonthAgo));
  const visitsLastMonth = visitsLastMonthResult[0]?.count || 0;

  // Calcular médias
  // Primeiro registro para calcular o período
  const firstRecordResult = await db
    .select({ createdAt: pageViews.createdAt })
    .from(pageViews)
    .orderBy(pageViews.createdAt)
    .limit(1);

  const firstRecord = firstRecordResult[0]?.createdAt;
  let avgVisitsPerHour = 0;
  let avgVisitsPerDay = 0;
  let avgVisitsPerMonth = 0;

  if (firstRecord) {
    const firstTime = new Date(firstRecord).getTime();
    const elapsedHours = Math.max(
      1,
      (now.getTime() - firstTime) / (60 * 60 * 1000),
    );
    const elapsedDays = Math.max(1, elapsedHours / 24);
    const elapsedMonths = Math.max(1, elapsedDays / 30);

    avgVisitsPerHour = Math.round((uniqueVisits / elapsedHours) * 10) / 10;
    avgVisitsPerDay = Math.round((uniqueVisits / elapsedDays) * 10) / 10;
    avgVisitsPerMonth = Math.round((uniqueVisits / elapsedMonths) * 10) / 10;
  }

  return {
    totalClicks,
    uniqueVisits,
    clicksByPage,
    visitsLastHour,
    avgVisitsPerHour,
    visitsToday,
    avgVisitsPerDay,
    visitsLastMonth,
    avgVisitsPerMonth,
  };
}

/**
 * Obtém estatísticas resumidas para a homepage
 */
export async function getMiniStats(): Promise<MiniStatsData> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Total de cliques
  const totalClicksResult = await db.select({ count: count() }).from(pageViews);
  const totalClicks = totalClicksResult[0]?.count || 0;

  // Visitas únicas (por IP)
  const uniqueVisitsResult = await db
    .select({ count: countDistinct(pageViews.ip) })
    .from(pageViews);
  const uniqueVisits = uniqueVisitsResult[0]?.count || 0;

  // Visitas hoje (IPs únicos)
  const visitsTodayResult = await db
    .select({ count: countDistinct(pageViews.ip) })
    .from(pageViews)
    .where(gte(pageViews.createdAt, todayStart));
  const visitsToday = visitsTodayResult[0]?.count || 0;

  // Visitas na última hora (IPs únicos)
  const visitsLastHourResult = await db
    .select({ count: countDistinct(pageViews.ip) })
    .from(pageViews)
    .where(gte(pageViews.createdAt, oneHourAgo));
  const visitsLastHour = visitsLastHourResult[0]?.count || 0;

  return {
    totalClicks,
    uniqueVisits,
    visitsToday,
    visitsLastHour,
  };
}

/**
 * Configuração de bucket por período do gráfico
 */
function getChartRangeConfig(range: ChartRange) {
  const now = new Date();

  switch (range) {
    case "year":
      return {
        start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        format: "%Y-%m",
        formatLabel: (bucket: string) => {
          const [y, m] = bucket.split("-");
          return `${MONTHS_PT[Number(m) - 1]}/${y.slice(2)}`;
        },
      };
    case "month":
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        format: "%Y-%m-%d",
        formatLabel: (bucket: string) => {
          const [, m, d] = bucket.split("-");
          return `${d}/${m}`;
        },
      };
    case "week":
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        format: "%Y-%m-%d",
        formatLabel: (bucket: string) => {
          const [, m, d] = bucket.split("-");
          return `${d}/${m}`;
        },
      };
    case "day":
      return {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        format: "%Y-%m-%d %H:00",
        formatLabel: (bucket: string) => bucket.slice(-5),
      };
    case "hour":
      return {
        start: new Date(now.getTime() - 60 * 60 * 1000),
        format: "%Y-%m-%d %H:%M",
        formatLabel: (bucket: string) => bucket.slice(-5),
      };
    default:
      return {
        start: null,
        format: "%Y-%m",
        formatLabel: (bucket: string) => {
          const [y, m] = bucket.split("-");
          return `${MONTHS_PT[Number(m) - 1]}/${y.slice(2)}`;
        },
      };
  }
}

const MONTHS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/**
 * Obtém dados de visitas/cliques agregados por período para os gráficos
 */
export async function getChartData(range: ChartRange): Promise<ChartPoint[]> {
  const { start, format, formatLabel } = getChartRangeConfig(range);

  const bucketExpr = sql<string>`strftime(${format}, ${pageViews.createdAt}, 'unixepoch')`;

  const rows = await db
    .select({
      bucket: bucketExpr,
      clicks: count(),
      uniqueVisits: countDistinct(pageViews.ip),
    })
    .from(pageViews)
    .where(start ? gte(pageViews.createdAt, start) : undefined)
    .groupBy(bucketExpr)
    .orderBy(bucketExpr);

  return rows.map((row) => ({
    bucket: row.bucket,
    label: formatLabel(row.bucket),
    clicks: row.clicks,
    uniqueVisits: row.uniqueVisits,
  }));
}
