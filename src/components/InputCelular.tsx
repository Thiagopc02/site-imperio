'use client';

import { useMemo, useState } from 'react';
import { FaGlobeAmericas } from 'react-icons/fa';

type InputCelularProps = {
  value: string;                       // mostrado no input
  onChange: (value: string) => void;   // recebe o valor mostrado
};

const onlyDigits = (s: string) => s.replace(/\D+/g, '');

export default function InputCelular({ value, onChange }: InputCelularProps) {
  const [isIntl, setIsIntl] = useState(false);
  const [ddi, setDdi] = useState(''); // usado quando isIntl = true

  // prefixo exibido
  const prefix = useMemo(() => {
    if (!isIntl) return '+55';
    const d = onlyDigits(ddi);
    return d ? `+${d}` : '+';
  }, [isIntl, ddi]);

  // máscara BR
  const formatBR = (raw: string) => {
    const d = onlyDigits(raw).slice(0, 11);
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (isIntl) {
      // internacional: sem máscara, só números (até 15)
      onChange(onlyDigits(raw).slice(0, 15));
    } else {
      onChange(formatBR(raw));
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-stretch overflow-hidden border rounded border-zinc-700">
        {/* prefixo (bandeira/Globo + DDI) */}
        <div className="flex items-center gap-2 px-3 border-r bg-zinc-800 border-zinc-700">
          {!isIntl ? (
            <>
              <span className="text-xl" title="Brasil" aria-label="Brasil">🇧🇷</span>
              <span className="text-xs font-medium text-green-400">+55</span>
            </>
          ) : (
            <>
              <FaGlobeAmericas className="text-zinc-200" />
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-16 text-xs bg-transparent outline-none text-zinc-200 placeholder-zinc-500"
                placeholder="DDI"
                value={ddi}
                onChange={(e) => setDdi(onlyDigits(e.target.value).slice(0, 3))}
              />
            </>
          )}
        </div>

        {/* campo telefone */}
        <input
          type="tel"
          className="flex-1 px-3 py-3 outline-none bg-zinc-900 text-zinc-100 placeholder-zinc-500"
          placeholder={isIntl ? 'Número (sem DDI)' : '(00) 00000-0000'}
          value={value}
          onChange={handleInput}
        />

        {/* alternar BR/Outros */}
        <button
          type="button"
          onClick={() => setIsIntl((v) => !v)}
          className="px-3 transition-colors border-l bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
          title={isIntl ? 'Usar Brasil (+55)' : 'Outros países'}
          aria-label="Alternar país"
        >
          {isIntl ? '🇧🇷' : '🌍'}
        </button>
      </div>

      {/* dica sobre como será enviado */}
      <p className="mt-1 text-xs text-zinc-400">
        Será enviado como {isIntl ? (prefix !== '+' ? `${prefix} + número` : '“+DDI + número”') : '+55 + número'}.
      </p>
    </div>
  );
}
