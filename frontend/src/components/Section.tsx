import React, { useRef, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface SectionProps {
  title: string;
  caption?: string;
  className?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export default function Section({
  title,
  caption,
  className = '',
  children,
  collapsible = false,
  defaultOpen = true,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number | 'none'>(defaultOpen ? 'none' : 0);

  useEffect(() => {
    if (!bodyRef.current) return;
    const h = bodyRef.current.scrollHeight;

    if (open) {
      setMaxH(h);
      const id = window.setTimeout(() => setMaxH('none'), 280);
      return () => window.clearTimeout(id);
    } else {
      setMaxH(h);
      requestAnimationFrame(() => setMaxH(0));
    }
  }, [open, children]);

  return (
    <section className={`bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
          {caption && <p className="mt-1 text-sm text-gray-600">{caption}</p>}
        </div>

        {collapsible && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-200"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            {open ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>

      {/* Key fix: overflow-hidden while animating max-height */}
      <div
        style={{ maxHeight: maxH === 'none' ? undefined : maxH }}
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div ref={bodyRef} className="pt-5">
          {children}
        </div>
      </div>
    </section>
  );
}
