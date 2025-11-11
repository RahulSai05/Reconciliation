
import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface TrendPoint {
  dateLabel: string;          // "Nov 1"
  stuckCount: number;         // e.g., 5
  totalShipmentsScaled: number; // e.g., 420 (scaled)
}

interface TrendLineChartProps {
  data: TrendPoint[];
}

export default function TrendLineChart({ data }: TrendLineChartProps) {
  // compute a sensible Y max
  const maxLeft =
    data && data.length
      ? Math.max(
          5,
          ...data.map((d) =>
            Math.max(
              Number.isFinite(d.stuckCount) ? d.stuckCount : 0,
              Number.isFinite(d.totalShipmentsScaled) ? d.totalShipmentsScaled : 0
            )
          )
        )
      : 5;

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 24, right: 24, top: 16, bottom: 16 }}>
          <CartesianGrid stroke="#444" strokeDasharray="3 3" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: "#ccc", fontSize: 12 }}
            stroke="#888"
          />
          <YAxis
            yAxisId="left"
            domain={[0, maxLeft]}
            tick={{ fill: "#ccc", fontSize: 12 }}
            stroke="#888"
            label={{
              value: "Stuck Shipments (and Total, scaled)",
              angle: -90,
              position: "insideLeft",
              fill: "#ccc",
              fontSize: 12,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #4b5563",
              borderRadius: "0.5rem",
              color: "#fff",
              fontSize: "0.75rem",
            }}
            labelStyle={{ color: "#fff" }}
          />
          <Legend wrapperStyle={{ color: "#fff", fontSize: "0.8rem" }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="stuckCount"
            name="Stuck Shipments"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="totalShipmentsScaled"
            name="Total Shipments (scaled)"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
