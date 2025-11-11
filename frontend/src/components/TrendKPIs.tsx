import React from 'react';

interface TrendKPIsProps {
  kpis: {
    label: string;          // "7-day Avg Stuck"
    value: string;          // "3.9"
    delta: string;          // "+0.6 vs 30d"
    positiveIsGood: boolean // true -> green pill, false -> red pill
  }[];
}

export default function TrendKPIs({ kpis }: TrendKPIsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-white">
      {kpis.map((kpi, idx) => (
        <div key={idx} className="space-y-2">
          <div className="text-sm text-gray-300 font-medium">
            {kpi.label}
          </div>
          <div className="text-4xl font-semibold leading-tight">
            {kpi.value}
          </div>
          <div>
            <span
              className={`inline-block text-xs font-semibold px-2 py-1 rounded-md ${
                kpi.positiveIsGood
                  ? 'bg-green-700/80 text-white'
                  : 'bg-red-700/80 text-white'
              }`}
            >
              {kpi.delta}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
