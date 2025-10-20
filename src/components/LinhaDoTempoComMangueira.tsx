// src/components/LinhaDoTempoComMangueira.tsx
'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type Marco = {
  ano: number;
  titulo: string;
  texto: string;
  imagem?: string;
};

type Props = {
  marcos: Marco[];
  passoInicial?: number;
  cor?: string;
  corEscura?: string;
  corLiquido?: string;
};

export default function LinhaDoTempoComMangueira({
  marcos,
  passoInicial = 0,
  cor = '#E10600',
  corEscura = '#7a0b0b',
  corLiquido = '#c81414',
}: Props) {
  const [ativo, setAtivo] = useState(passoInicial);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const secRefs = useRef<HTMLDivElement[]>([]);
  useEffect(() => {
    secRefs.current = [];
  }, [marcos.length]);

  const addRef = (el: HTMLDivElement | null): void => {
    if (el && !secRefs.current.includes(el)) secRefs.current.push(el);
  };

  const [svgSize, setSvgSize] = useState({ w: 1200, h: 600 });
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);

  const recalcular = useCallback(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const rectWrap = wrap.getBoundingClientRect();

    const w = rectWrap.width;
    const h = wrap.scrollHeight;
    const centerX = w / 2;
    const ampX = Math.min(180, Math.max(120, w * 0.12));

    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < secRefs.current.length; i++) {
      const s = secRefs.current[i];
      const r = s.getBoundingClientRect();
      const centerY = r.top - rectWrap.top + r.height / 2;
      const x = centerX + (i % 2 === 0 ? -ampX : ampX);
      pts.push({ x, y: centerY });
    }
    setSvgSize({ w: Math.max(800, w), h: Math.max(h, 400) });
    setPoints(pts);
  }, []);

  useLayoutEffect(() => {
    recalcular();

    const canObserve =
      typeof window !== 'undefined' && 'ResizeObserver' in window;

    let ro: ResizeObserver | null = null;
    if (canObserve && wrapperRef.current) {
      ro = new ResizeObserver(() => recalcular());
      ro.observe(wrapperRef.current);
    }

    const onResize = () => recalcular();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
    };
  }, [recalcular, marcos.length]);

  const hosePath = useMemo(() => {
    if (!points.length) return '';
    const segs: string[] = [];
    segs.push(`M ${points[0].x} ${points[0].y}`);
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cx = (p0.x + p1.x) / 2;
      segs.push(`C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`);
    }
    const last = points[points.length - 1];
    const endX = Math.min(svgSize.w - 60, last.x + 120);
    const endY = last.y + 36;
    segs.push(`C ${endX - 80} ${last.y}, ${endX - 30} ${endY}, ${endX} ${endY}`);
    return segs.join(' ');
  }, [points, svgSize.w]);

  const pathRef = useRef<SVGPathElement | null>(null);
  const [comprimento, setComprimento] = useState(1);
  useEffect(() => {
    if (pathRef.current) setComprimento(pathRef.current.getTotalLength());
  }, [hosePath]);

  const progresso =
    marcos.length <= 1 ? 1 : Math.min(1, ativo / (marcos.length - 1));
  const dashArray = comprimento;
  const dashOffset = Math.max(0, comprimento * (1 - progresso));

  const irPara = (idx: number) => {
    const el = secRefs.current[idx];
    if (!el) return;
    setAtivo(idx);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const proximo = (idx: number) => Math.min(idx + 1, marcos.length - 1);

  return (
    <div className="w-full">
      <div className="max-w-6xl px-3 mx-auto">
        <h2 className="mb-6 text-3xl font-extrabold text-center text-white md:text-4xl">
          Histórias de Grandes Marcas
        </h2>

        <div ref={wrapperRef} className="relative">
          {/* SVG da mangueira */}
          <svg
            className="absolute inset-0 z-0 pointer-events-none"
            width="100%"
            height={svgSize.h}
            viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="ltm-glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="ltm-liquid" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={corEscura} />
                <stop offset="60%" stopColor={cor} />
                <stop offset="100%" stopColor={corLiquido} />
              </linearGradient>
            </defs>

            <path
              d={hosePath}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
              filter="url(#ltm-glow)"
            />
            <path
              ref={pathRef}
              d={hosePath}
              stroke="url(#ltm-liquid)"
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
              style={{
                strokeDasharray: dashArray,
                strokeDashoffset: dashOffset,
                transition: 'stroke-dashoffset 900ms ease',
              }}
              filter="url(#ltm-glow)"
            />
          </svg>

          {/* Seções */}
          <div className="relative z-10 space-y-10">
            {marcos.map((m, idx) => {
              const invert = idx % 2 === 1;
              const isAtivo = idx === ativo;
              return (
                <section
                  key={`${m.ano}-${idx}`}
                  ref={addRef}
                  className={[
                    'grid items-center gap-6 md:grid-cols-2',
                    invert ? 'md:[&>*:first-child]:order-2' : '',
                    'rounded-2xl p-5 ring-1 ring-white/10',
                    'bg-gradient-to-b from-white/[.02] to-white/[.04]',
                  ].join(' ')}
                >
                  <div>
                    <div className="inline-flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/15 ring-1 ring-white/20">
                        {m.ano}
                      </span>
                      {isAtivo && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/90 text-black font-semibold">
                          Parte atual
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-extrabold">
                      {m.ano} — {m.titulo}
                    </h3>
                    <p className="mt-2 text-white/80">{m.texto}</p>
                    <div className="mt-3 text-[11px] text-white/60">
                      Passo {idx + 1} de {marcos.length}
                    </div>
                  </div>

                  <div className="w-full max-w-xl justify-self-center">
                    {m.imagem ? (
                      <div className="relative h-56 bg-white md:h-64 rounded-xl">
                        <Image
                          src={m.imagem}
                          alt={`${m.ano} — ${m.titulo}`}
                          fill
                          className="object-contain rounded-xl"
                          sizes="(min-width: 768px) 32rem, 100vw"
                          priority={idx === 0}
                        />
                      </div>
                    ) : (
                      <div className="grid h-56 md:h-64 rounded-xl bg-white/5 ring-1 ring-white/10 place-items-center text-white/50">
                        sem imagem
                      </div>
                    )}

                    <div className="flex justify-end mt-3">
                      <button
                        onClick={() => irPara(proximo(idx))}
                        className="px-3 py-1.5 text-sm rounded-lg font-semibold text-white transition"
                        style={{ backgroundColor: cor }}
                        disabled={idx === marcos.length - 1}
                        title={
                          idx === marcos.length - 1
                            ? 'Fim da história'
                            : 'Ir para a próxima parte'
                        }
                      >
                        Próxima parte
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}

            {/* Copo final (enche com o progresso) */}
            <div className="flex justify-center pt-6">
              <div className="relative w-40 h-48">
                <div className="absolute inset-0 rounded-b-xl rounded-t-md ring-2 ring-white/30 bg-white/5 backdrop-blur-[1px]" />
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-b-xl transition-[height] duration-900"
                  style={{
                    height: `${Math.min(
                      100,
                      (marcos.length <= 1 ? 1 : ativo / (marcos.length - 1)) *
                        100
                    )}%`,
                    background: `linear-gradient(180deg, ${cor} 0%, ${corLiquido} 70%)`,
                    boxShadow: 'inset 0 8px 18px rgba(0,0,0,.35)',
                  }}
                />
                <div className="absolute inset-0 pointer-events-none rounded-b-xl rounded-t-md bg-gradient-to-br from-white/10 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
