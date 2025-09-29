'use client';

import { FaStar } from 'react-icons/fa';
import { useMemo } from 'react';

type StarsProps = {
  /** valor atual (0–5) */
  value: number;
  /** callback quando o usuário clicar/alterar (omitido => modo readOnly) */
  onChange?: (newValue: number) => void;
  /** desabilita interação (equivale a onChange ausente) */
  readOnly?: boolean;
  /** tamanho opcional do ícone (px) */
  size?: number;
  /** rótulo acessível (aria-label base) */
  label?: string;
  /** classe extra para o contêiner */
  className?: string;
};

export default function Stars({
  value,
  onChange,
  readOnly,
  size = 18,
  label = 'Avaliação',
  className = '',
}: StarsProps) {
  const safeValue = useMemo(() => {
    if (Number.isNaN(value)) return 0;
    return Math.min(5, Math.max(0, Math.round(value)));
  }, [value]);

  const interactive = !!onChange && !readOnly;

  const handleClick = (n: number) => {
    if (!interactive) return;
    onChange?.(n);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange?.(Math.min(5, safeValue + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange?.(Math.max(1, safeValue - 1));
    } else if (/^[1-5]$/.test(e.key)) {
      onChange?.(parseInt(e.key, 10));
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      role="img"
      aria-label={`${label}: ${safeValue} de 5`}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={handleKeyDown}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        const filled = n <= safeValue;
        const Icon = (
          <FaStar
            size={size}
            className={filled ? 'text-yellow-400' : 'text-zinc-600'}
            aria-hidden
          />
        );
        if (!interactive) return <span key={n}>{Icon}</span>;
        return (
          <button
            key={n}
            type="button"
            onClick={() => handleClick(n)}
            aria-label={`${label}: escolher ${n} estrela${n > 1 ? 's' : ''}`}
            className="rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            {Icon}
          </button>
        );
      })}
    </div>
  );
}
