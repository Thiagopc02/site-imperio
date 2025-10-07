'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Marco = { ano: number; titulo: string; texto: string };

type Props = {
  marcos: Marco[];              // seus itens da linha do tempo
  passoInicial?: number;        // índice inicial selecionado
};

export default function LinhaDoTempoComMangueira({ marcos, passoInicial = 0 }: Props) {
  const [ativo, setAtivo] = useState(passoInicial);

  // ----- Geometria do SVG (escala fixa, responsiva por preserveAspectRatio) -----
  const W = 1000;          // largura do viewBox
  const H = 180;           // altura do viewBox
  const yLinha = 70;       // Y da régua / bolinhas
  const yCopo = 150;       // Y da boca do copo (alvo da mangueira)
  const xCopo = W - 60;    // X do copo (lado direito)

  const xs = useMemo(() => {
    if (marcos.length <= 1) return [40, xCopo - 40];
    const dx = (xCopo - 120) / (marcos.length - 1);
    return Array.from({ length: marcos.length }, (_, i) => 60 + dx * i);
  }, [marcos.length]);

  // Path: passa por cada marco e depois curva até o copo
  const d = useMemo(() => {
    if (!xs.length) return '';
    const move = `M ${xs[0]} ${yLinha}`;
    const linhas = xs.slice(1).map((x) => `L ${x} ${yLinha}`).join(' ');
    // Curva suave descendo até a boca do copo
    const curva = `C ${xCopo - 120} ${yLinha}, ${xCopo - 120} ${yCopo}, ${xCopo} ${yCopo}`;
    return `${move} ${linhas} ${curva}`;
  }, [xs]);

  // ----- Animação do traço preenchendo até o passo ativo -----
  const pathRef = useRef<SVGPathElement | null>(null);
  const [compr, setCompr] = useState(1);
  useEffect(() => {
    if (pathRef.current) setCompr(pathRef.current.getTotalLength());
  }, [d]);

  const progresso = marcos.length > 1 ? ativo / (marcos.length - 1) : 1;
  const dashArray = compr;
  const dashOffset = Math.max(0, compr * (1 - progresso));

  return (
    <div className="w-full">
      <div className="max-w-6xl px-3 mx-auto">
        <h2 className="mb-6 text-3xl font-extrabold text-center text-white md:text-4xl">
          Histórias de Grandes Marcas
        </h2>

        {/* Régua e anos */}
        <div className="relative p-4 bg-black/40 rounded-xl">
          {/* SVG Mangueira */}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-40"
          >
            {/* brilho difuso atrás da mangueira */}
            <defs>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="hoseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.55)" />
              </linearGradient>
            </defs>

            {/* trilho (mangueira “vazia”) */}
            <path
              d={d}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              filter="url(#softGlow)"
            />
            {/* preenchimento que avança */}
            <path
              ref={pathRef}
              d={d}
              stroke="url(#hoseGrad)"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              style={{
                strokeDasharray: dashArray,
                strokeDashoffset: dashOffset,
                transition: 'stroke-dashoffset 800ms ease',
              }}
              filter="url(#softGlow)"
            />
            {/* bolinhas dos anos */}
            {xs.map((x, i) => (
              <circle
                key={i}
                cx={x}
                cy={yLinha}
                r={10}
                fill={i <= ativo ? '#ef4444' : '#7f1d1d'}
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}

            {/* “boca do copo” (alvo final) */}
            <rect
              x={xCopo - 18}
              y={yCopo - 22}
              width="36"
              height="44"
              rx="10"
              fill="url(#hoseGrad)"
              opacity="0.35"
            />
            <rect
              x={xCopo - 22}
              y={yCopo + 24}
              width="44"
              height="70"
              rx="18"
              fill="url(#hoseGrad)"
              opacity="0.15"
            />
          </svg>

          {/* Marcadores clicáveis e anos */}
          <div className="relative -mt-8">
            <div className="flex items-center justify-between">
              {marcos.map((m, i) => (
                <button
                  key={m.ano}
                  onClick={() => setAtivo(i)}
                  className="flex flex-col items-center w-16 group md:w-20"
                >
                  <span
                    className={[
                      'h-3 w-3 rounded-full mb-2',
                      i <= ativo ? 'bg-red-500' : 'bg-red-900',
                      'ring-2 ring-white/70 group-hover:scale-110 transition',
                    ].join(' ')}
                  />
                  <span className="text-xs text-white/80">{m.ano}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card do passo ativo */}
        <AnimatePresence mode="wait">
          <motion.div
            key={ativo}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="p-5 mt-6 text-white shadow-xl rounded-2xl bg-neutral-900"
          >
            <div className="text-lg font-semibold">
              {marcos[ativo].ano} — {marcos[ativo].titulo}
            </div>
            <p className="mt-1 text-white/80">{marcos[ativo].texto}</p>
            <div className="mt-3 text-xs text-white/50">
              Passo {ativo + 1} de {marcos.length}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
