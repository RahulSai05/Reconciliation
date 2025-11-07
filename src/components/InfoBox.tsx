import { Info } from 'lucide-react';

interface InfoBoxProps {
  children: React.ReactNode;
}

export default function InfoBox({ children }: InfoBoxProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 text-sm text-blue-900 leading-relaxed">
      <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}
