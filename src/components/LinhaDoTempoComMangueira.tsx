// src/components/LinhaDoTempoComMangueira.tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type Marco = {
  ano: number;
  titulo: string;
  texto: string;
  imagem?: string; // caminho em /public (opcional)
};

type Props = {
  marcos: Marco[];          // itens da linha do tempo (em ordem)
  passoInicial?: number;    // índice inicial
  cor?: string;             // cor principal do “líquido” (ex.: #E10600)
  corEscura?: string;       // cor escura para o gradiente
  corLiquido?: string;      // terceira cor no gradiente
};

export default function LinhaDoTempoComMangueira({
  marcos,
  passoInicial = 0,
  cor = "#E10600",
  corEscura = "#7a0b0b",
  corLiquido = "#c81414",
}: Props) {
  const [ativo, setAtivo] = useState(passoInicial);

  // --------- refs/medidas para a mangueira vertical -----------
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const secRefs = useRef<HTMLDivElement[]>([]);
  secRefs.current = [];

  const addRef = (el: HTMLDivElement | null) => {
    if (el && !secRefs.current.includes(el)) secRefs.current.push(el);
  };

  const [svgSize, setSvgSize] = useState({ w: 1200, h: 600 });
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);

  const recalcular = () => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const rectWrap = wrap.getBoundingClientRect();

    const w = rectWrap.width;
    const h = wrap.scrollHeight;
    const centerX = w / 2;
    const ampX = Math.min(180, Math.max(120, w * 0.12)); // quanto “entra e sai” do centro

    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < secRefs.current.length; i++) {
      const s = secRefs.current[i];
      const r = s.getBoundingClientRect();
      const centerY = r.top - rectWrap.top + r.height / 2; // relativo ao wrapper
      const x = centerX + (i % 2 === 0 ? -ampX : ampX);
      pts.push({ x, y: centerY });
    }
    setSvgSize({ w: Math.max(800, w), h: Math.max(h, 400) });
    setPoints(pts);
  };

  useLayoutEffect(() => {
    recalcular();
    const ro = new ResizeObserver(() => recalcular());
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    window.addEventListener("resize", recalcular);
    return () => {
      window.removeEventListener("resize", recalcular);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcos.length]);

  const hosePath = useMemo(() => {
    if (!points.length) return "";
    const segs: string[] = [];
    segs.push(`M ${points[0].x} ${points[0].y}`);
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cx = (p0.x + p1.x) / 2; // controle no meio para suavizar
      segs.push(`C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`);
    }
    // pequena curva final
    const last = points[points.length - 1];
    const endX = Math.min(svgSize.w - 60, last.x + 120);
    const endY = last.y + 36;
    segs.push(`C ${endX - 80} ${last.y}, ${endX - 30} ${endY}, ${endX} ${endY}`);
    return segs.join(" ");
  }, [points, svgSize.w]);

  // comprimento para animar o traço
  const pathRef = useRef<SVGPathElement | null>(null);
  const [comprimento, setComprimento] = useState(1);
  useEffect(() => {
    if (pathRef.current) setComprimento(pathRef.current.getTotalLength());
  }, [hosePath]);

  const progresso = marcos.length <= 1 ? 1 : Math.min(1, ativo / (marcos.length - 1));
  const dashArray = comprimento;
  const dashOffset = Math.max(0, comprimento * (1 - progresso));

  // navegação
  const irPara = (idx: number) => {
    const el = secRefs.current[idx];
    if (!el) return;
    setAtivo(idx);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const proximo = (idx: number) => Math.min(idx + 1, marcos.length - 1);

  return (
    <div className="w-full">
      <div className="max-w-6xl px-3 mx-auto">
        <h2 className="mb-6 text-3xl font-extrabold text-center text-white md:text-4xl">
          Histórias de Grandes Marcas
        </h2>

        {/* WRAPPER com SVG absoluto descendo por trás das seções */}
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
              {/* gradiente do líquido na cor da marca */}
              <linearGradient id="ltm-liquid" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={corEscura} />
                <stop offset="60%" stopColor={cor} />
                <stop offset="100%" stopColor={corLiquido} />
              </linearGradient>
            </defs>

            {/* tubo translúcido */}
            <path
              d={hosePath}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
              filter="url(#ltm-glow)"
            />
            {/* líquido que avança (cor da marca) */}
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
                transition: "stroke-dashoffset 900ms ease",
              }}
              filter="url(#ltm-glow)"
            />
          </svg>

          {/* Seções: alternando texto/imagem e ano dentro do card */}
          <div className="relative z-10 space-y-10">
            {marcos.map((m, idx) => {
              const invert = idx % 2 === 1;
              const isAtivo = idx === ativo;
              return (
                <section
                  key={`${m.ano}-${idx}`}
                  ref={addRef}
                  className={[
                    "grid items-center gap-6 md:grid-cols-2",
                    invert ? "md:[&>*:first-child]:order-2" : "",
                    "rounded-2xl p-5 ring-1 ring-white/10",
                    "bg-gradient-to-b from-white/[.02] to-white/[.04]",
                  ].join(" ")}
                >
                  {/* Texto */}
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

                  {/* Imagem (opcional) + botão Próxima parte */}
                  <div className="w-full max-w-xl justify-self-center">
                    {m.imagem ? (
                      <img
                        src={m.imagem}
                        alt={`${m.ano} — ${m.titulo}`}
                        className="object-contain w-full h-56 bg-white md:h-64 rounded-xl"
                      />
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
                        title={idx === marcos.length - 1 ? "Fim da história" : "Ir para a próxima parte"}
                      >
                        Próxima parte
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
