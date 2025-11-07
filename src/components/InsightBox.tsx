interface InsightBoxProps {
  label: string;
  value: string;
}

export default function InsightBox({ label, value }: InsightBoxProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex-1 min-w-[200px]">
      <div className="text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}
