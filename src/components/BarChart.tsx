interface BarChartProps {
  data: {
    label: string;
    value: number;
    color: string;
  }[];
}

export default function BarChart({ data }: BarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="space-y-4">
      {data.map((item, idx) => (
        <div key={idx} className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-gray-700">{item.label}</span>
            <span className="text-lg font-semibold text-gray-900">{item.value}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-3 ${item.color}`}
              style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
            >
              {item.value > 0 && (
                <span className="text-xs font-semibold text-white">{item.value}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
