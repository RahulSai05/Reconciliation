interface KPICardProps {
  title: string;
  value: number | string;
  subtitle: string;
  valueColor?: string;
}

export default function KPICard({ title, value, subtitle, valueColor = 'text-gray-900' }: KPICardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex-1 min-w-[200px]">
      <div className="text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {title}
      </div>
      <div className={`text-3xl font-semibold ${valueColor} mb-1`}>
        {value}
      </div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}
