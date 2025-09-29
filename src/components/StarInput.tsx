'use client';

import { useState } from 'react';

type Props = {
  value: number;
  onChange: (v: number) => void;
};

export default function StarInput({ value, onChange }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const current = hover ?? value;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;
        const active = current >= idx;
        return (
          <button
            key={idx}
            type="button"
            className="p-0.5"
            onMouseEnter={() => setHover(idx)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange(idx)}
            aria-label={`${idx} estrela${idx > 1 ? 's' : ''}`}
            title={`${idx} estrela${idx > 1 ? 's' : ''}`}
          >
            <svg width={22} height={22} viewBox="0 0 20 20" className={active ? 'fill-yellow-400' : 'fill-zinc-700'}>
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.036a1 1 0 0 0 -.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118L10.95 13.94a1 1 0 0 0-1.175 0l-2.385 1.734c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0 -.364-1.118L3.756 8.72c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 0 0 .95-.69l1.293-3.293Z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
