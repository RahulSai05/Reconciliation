interface BadgeProps {
  variant: 'danger' | 'warning' | 'success' | 'info' | 'neutral';
  children: React.ReactNode;
}

export default function Badge({ variant, children }: BadgeProps) {
  const colors = {
    danger: 'bg-red-600',
    warning: 'bg-amber-500',
    success: 'bg-green-500',
    info: 'bg-blue-500',
    neutral: 'bg-gray-500',
  };

  return (
    <span className={`inline-block px-2.5 py-1.5 rounded-full text-xs font-semibold text-white ${colors[variant]}`}>
      {children}
    </span>
  );
}
