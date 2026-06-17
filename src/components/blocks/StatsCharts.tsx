"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";
import {
  getChartData,
  type ChartPoint,
  type ChartRange,
} from "@/actions/stats";

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "year", label: "Por Ano" },
  { value: "month", label: "Por Mês" },
  { value: "week", label: "Por Semana" },
  { value: "day", label: "Por Dia" },
  { value: "hour", label: "Por Hora" },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-background border border-primary/30 rounded-lg p-3 shadow-lg">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="text-sm font-medium"
          style={{ color: entry.color }}
        >
          {entry.name}: {entry.value.toLocaleString("pt-BR")}
        </p>
      ))}
    </div>
  );
}

export function StatsCharts() {
  const [range, setRange] = useState<ChartRange>("week");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getChartData(range);
      setData(result);
    });
  }, [range]);

  return (
    <div className="bg-background-alt border border-primary/20 rounded-xl p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Visitas e Cliques</h3>
        </div>
        <div className="flex flex-wrap gap-1 bg-background rounded-lg p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                range === opt.value
                  ? "bg-primary text-background"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`h-72 transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}
      >
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            Nenhum dado para este período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d5984e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#d5984e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorUnique" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.08)"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
              <Area
                type="monotone"
                dataKey="clicks"
                name="Cliques"
                stroke="#d5984e"
                fill="url(#colorClicks)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="uniqueVisits"
                name="Visitas Únicas"
                stroke="#34d399"
                fill="url(#colorUnique)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
