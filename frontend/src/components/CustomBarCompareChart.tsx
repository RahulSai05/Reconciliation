

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export type ScoreMetric =
  | "stuckCount"          // today: open exceptions count
  | "avgAgeHrs"           // today: avg hours
  | "failureRatePct"      // today: %
  | "shareOfStuck7d"      // last 7d: %
  | "avgAgeHrs7d"         // last 7d: hours
  | "failureRatePct7d";   // last 7d: %

export interface WarehouseStatsPoint {
  warehouse: string;

  // today
  stuckCount?: number;
  avgAgeHrs?: number;
  failureRatePct?: number;

  // 7d (pre-computed in App from history)
  shareOfStuck7d?: number;
  avgAgeHrs7d?: number;
  failureRatePct7d?: number;
}

interface CustomBarCompareChartProps {
  data: WarehouseStatsPoint[];
  metric: ScoreMetric;
}

const labelForMetric = (m: ScoreMetric) => {
  switch (m) {
    case "stuckCount":
      return "Open Exceptions (count)";
    case "avgAgeHrs":
      return "Average Age (hrs)";
    case "failureRatePct":
      return "Load Failure (%)";
    case "shareOfStuck7d":
      return "Share of Stuck (7d, %)";
    case "avgAgeHrs7d":
      return "Average Age (7d, hrs)";
    case "failureRatePct7d":
      return "EDI Failure Rate (7d, %)";
  }
};

const formatValue = (metric: ScoreMetric, v: number) => {
  if (metric.endsWith("Pct") || metric.endsWith("Pct7d") || metric === "shareOfStuck7d") {
    return `${(v ?? 0).toFixed(1)}%`;
  }
  if (metric.includes("Age")) {
    return `${(v ?? 0).toFixed(1)}h`;
  }
  return `${Math.round(v ?? 0)}`;
};

export default function CustomBarCompareChart({
  data,
  metric,
}: CustomBarCompareChartProps) {
  // Map to chart rows and coerce numbers
  const chartData = useMemo(() => {
    const toNum = (x: any) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    };

    const read = (row: WarehouseStatsPoint) => {
      switch (metric) {
        case "stuckCount":
          return toNum(row.stuckCount);
        case "avgAgeHrs":
          return toNum(row.avgAgeHrs);
        case "failureRatePct":
          return toNum(row.failureRatePct);
        case "shareOfStuck7d":
          return toNum(row.shareOfStuck7d);
        case "avgAgeHrs7d":
          return toNum(row.avgAgeHrs7d);
        case "failureRatePct7d":
          return toNum(row.failureRatePct7d);
        default:
          return 0;
      }
    };

    return (data || []).map((row) => ({
      name: row.warehouse || "Unknown",
      value: read(row),
    }));
  }, [data, metric]);

  const yMax =
    chartData.length > 0
      ? Math.max(5, ...chartData.map((d) => (Number.isFinite(d.value) ? d.value : 0)))
      : 5;

  const allZeros = chartData.every((d) => !d.value);

  return (
    <div className="w-full h-[260px] relative">
      {allZeros && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 z-10">
          No data for the selected metric / time window
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 24, right: 24, top: 16, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="name" tick={{ fill: "#ccc", fontSize: 12 }} stroke="#888" />
          <YAxis
            domain={[0, yMax]}
            tick={{ fill: "#ccc", fontSize: 12 }}
            stroke="#888"
            label={{
              value: labelForMetric(metric),
              angle: -90,
              position: "insideLeft",
              fill: "#ccc",
              fontSize: 12,
            }}
          />
          <Tooltip
            formatter={(v) => [formatValue(metric, Number(v)), labelForMetric(metric)]}
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #4b5563",
              borderRadius: "0.5rem",
              color: "#fff",
              fontSize: "0.75rem",
            }}
            labelStyle={{ color: "#fff" }}
          />
          <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
