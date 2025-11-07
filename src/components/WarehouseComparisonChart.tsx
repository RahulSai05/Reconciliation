import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

export interface WarehouseMetricRow {
  metric: string;           // "Stuck Count", "Avg Age (hrs)", "Load Failure %"
  selectedValue: number;    // warehouse-specific
  overallValue: number;     // all warehouses
}

interface WarehouseComparisonChartProps {
  data: WarehouseMetricRow[];
  selectedWarehouse: string;
}

export default function WarehouseComparisonChart({
  data,
  selectedWarehouse,
}: WarehouseComparisonChartProps) {
  return (
    <div className="w-full h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 24, right: 24, top: 16, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="metric"
            tick={{ fill: '#ccc', fontSize: 12 }}
            stroke="#888"
          />
          <YAxis
            tick={{ fill: '#ccc', fontSize: 12 }}
            stroke="#888"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #4b5563',
              borderRadius: '0.5rem',
              color: '#fff',
              fontSize: '0.75rem',
            }}
          />
          <Legend
            wrapperStyle={{ color: '#fff', fontSize: '0.8rem' }}
          />
          <Bar
            dataKey="selectedValue"
            name={selectedWarehouse}
            fill="#3b82f6" // blue-500
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="overallValue"
            name="All Warehouses"
            fill="#6b7280" // gray-500
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
