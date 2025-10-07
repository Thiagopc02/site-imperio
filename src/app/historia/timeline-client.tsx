// src/app/historia/timeline-client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Brand } from "./page";

/**
 * O comportamento:
 * - A mangueira (SVG) faz curvas suaves passando pelos "pontos" centrais de cada evento.
 * - Ao clicar numa data, o "líquido" avança até aquele ponto (anima o strokeDashoffset).
 * - As seções de evento alternam: texto à esquerda / imagem à direita e vice-versa.
 * - Em telas pequenas, tudo empilha (acessível).
 */

type Props = { brands: Brand[] };

export default function TimelineClient({ brands }: Props) {
  const [activeSlug, setActiveSlug] = useState(brands[0]?.slug ?? "");
  const brand = useMemo(
    () => brands.find((b) => b.slug === activeSlug) ?? brands[0],
    [activeSlug, brands]
  );

  const total = brand.events.length;
  const [activeIdx, setActiveIdx] = useState(0);

  // === Tema (cores) ===
  const themeVars = {
    ["--brand" as any]: brand.color,
    ["--brandDark" as any]: brand.dark,
    ["--liquid" as any]: brand.liquid,
  };

  // === Geometria do SVG (mangueira) ===
  // ViewBox fixo para responsividade. O SVG fica ABSOLUTO no "corredor" central.
  const W = 1400;                 // largura do viewBox
  const H = 420;                  // altura do viewBox
  const marginX = 80;             // margem interna
  const midY = H / 2;             // linha central
  const amplitude = 120;          // quanto a mangueira "sobe/desce"
  const xGlass = W - 60;          // posição do copo
  const yGlass = midY + 70;

  // Pontos meândricos: X igualmente espaçado; Y alternando acima/abaixo do centro.
  const points = useMemo(() => {
    if (total === 0) return [] as Array<{ x: number; y: number }>;
    const dx = (xGlass - marginX * 2) / Math.max(1, total - 1);
    return brand.events.map((_, i) => ({
      x: marginX + dx * i,
      y: midY + (i % 2 === 0 ? -amplitude : amplitude) * 0.85, // curvas suaves
    }));
  }, [brand.events, total]);

  // Constrói um path cúbico suave passando pelos pontos e curvando até a boca do copo
  const hosePath = useMemo(() => {
    if (!points.length) return "";
    const segs: string[] = [];
    segs.push(`M ${points[0].x} ${points[0].y}`);
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cx = (p0.x + p1.x) / 2;      // controle no meio para suavizar
      segs.push(
        `C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`
      );
    }
    // curva final descendo/encaixando na "boca" do copo
    const last = points[points.length - 1];
    segs.push(
      `C ${xGlass - 120} ${last.y}, ${xGlass - 120} ${yGlass}, ${xGlass} ${yGlass}`
    );
    return segs.join(" ");
  }, [points]);

  // Animação do traço preenchendo até o índice ativo
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(1);
  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      setPathLen(len);
    }
  }, [hosePath]);

  // Progresso: porcentagem do caminho até o ponto clicado
  const progress = total <= 1 ? 1 : Math.min(1, activeIdx / (total - 1));
  const dashArray = pathLen;
  const dashOffset = Math.max(0, pathLen * (1 - progress));

  // Scroll para a seção ao clicar na data
  const goTo = (id: string, idx: number) => {
    setActiveIdx(idx);
    const el = document.getElementById(id);
    if (!el) return;
    // pequeno atraso para o usuário "ver" a mangueira encher
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  // Topo
  const goTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <section className="pb-24" style={themeVars}>
      {/* Seleção de marcas */}
      <div id="topo-historia" className="container pb-4">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {brands.map((b) => (
            <button
              key={b.slug}
              onClick={() => {
                setActiveSlug(b.slug);
                setActiveIdx(0);
                goTop();
              }}
              className="group relative rounded-full p-[3px]"
              style={{
                background:
                  b.slug === brand.slug
                    ? `radial-gradient(35% 35% at 30% 25%, rgba(255,255,255,.9), rgba(255,255,255,.05)), var(--brand)`
                    : "linear-gradient(180deg, #1f2937 0%, #111827 100%)",
              }}
              aria-label={`Ver ${b.name}`}
              title={`Ver ${b.name}`}
            >
              <span className="block overflow-hidden rounded-full shadow-lg size-20 md:size-24 ring-2 ring-white/20">
                <img
                  src={b.logo}
                  alt={b.name}
                  className="object-cover w-full h-full"
                />
              </span>
              {b.slug === brand.slug && (
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[11px] rounded-full bg-white/90 text-black font-semibold shadow">
                  {b.name}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Corredor central com a MANGUEIRA meandrando */}
      <div className="relative">
        {/* SVG absoluto por trás dos cards */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-[380px] md:h-[420px]"
          >
            <defs>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="hoseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
              </linearGradient>
            </defs>

            {/* trilho (mangueira transparente) */}
            <path
              d={hosePath}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              filter="url(#softGlow)"
            />
            {/* líquido que avança */}
            <path
              ref={pathRef}
              d={hosePath}
              stroke="url(#hoseGrad)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              style={{
                strokeDasharray: dashArray,
                strokeDashoffset: dashOffset,
                transition: "stroke-dashoffset 800ms ease",
              }}
              filter="url(#softGlow)"
            />
            {/* boca do copo (destino visual) */}
            <rect
              x={xGlass - 18}
              y={yGlass - 22}
              width="36"
              height="44"
              rx="10"
              fill="url(#hoseGrad)"
              opacity="0.35"
            />
          </svg>
        </div>

        {/* Barra de datas clicável (em cima do corredor) */}
        <div className="container relative z-10">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {brand.events.map((ev, idx) => (
              <button
                key={ev.id}
                onClick={() => goTo(ev.id, idx)}
                className={[
                  "flex items-center gap-2 px-2 py-1 rounded-full",
                  "bg-white/8 hover:bg-white/15 ring-1 ring-white/10 transition",
                ].join(" ")}
                title={`Ir para ${ev.year}`}
              >
                <span
                  className={[
                    "inline-block size-2.5 rounded-full",
                    idx <= activeIdx ? "bg-[var(--brand)]" : "bg-white/60",
                  ].join(" ")}
                />
                <span
                  className={[
                    "text-xs",
                    idx <= activeIdx ? "text-white" : "text-white/80",
                  ].join(" ")}
                >
                  {ev.year}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-2 text-xs text-center text-white/70">
            Progresso: {(progress * 100).toFixed(0)}% ({activeIdx + 1}/{total})
          </div>
        </div>
      </div>

      {/* Seções alternando lados (texto/imagem) */}
      <div className="container relative z-10 mt-8 space-y-10">
        {brand.events.map((ev, idx) => {
          const invert = idx % 2 === 1; // alterna lado
          return (
            <section
              id={ev.id}
              key={ev.id}
              className={[
                "grid gap-6 items-center",
                "md:grid-cols-2",
                invert ? "md:[&>*:first-child]:order-2" : "",
                "rounded-2xl p-5 ring-1 ring-white/10",
                "bg-gradient-to-b from-white/[.02] to-white/[.04]",
              ].join(" ")}
            >
              {/* Texto */}
              <div>
                <h3 className="text-xl font-extrabold">
                  {ev.year} — {ev.title}
                </h3>
                <p className="mt-2 text-white/80">{ev.text}</p>
                <div className="mt-3 text-[11px] text-white/60">
                  Passo {idx + 1} de {total}
                </div>
              </div>

              {/* Imagem (se houver) */}
              <div className="w-full max-w-xl justify-self-center">
                {ev.image ? (
                  <img
                    src={ev.image}
                    alt={`${brand.name} — ${ev.year}`}
                    className="object-contain w-full h-56 bg-white md:h-64 rounded-xl"
                    onLoad={() => {
                      // opcional: ao carregar a imagem do passo atual,
                      // se o usuário clicou num passo anterior, mantém;
                      // se for o passo ativo, nada a fazer.
                    }}
                  />
                ) : (
                  <div className="grid h-56 md:h-64 rounded-xl bg-white/5 ring-1 ring-white/10 place-items-center text-white/50">
                    sem imagem
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {/* Copo preenchendo (decorativo) */}
        <div className="flex justify-center pt-6">
          <div className="relative w-40 h-48">
            <div className="absolute inset-0 rounded-b-xl rounded-t-md ring-2 ring-white/30 bg-white/5 backdrop-blur-[1px]" />
            <div
              className="absolute bottom-0 left-0 right-0 rounded-b-xl transition-[height] duration-800"
              style={{
                height: `${progress * 100}%`,
                background:
                  "linear-gradient(180deg, var(--brand) 0%, var(--liquid) 70%)",
                boxShadow: "inset 0 8px 18px rgba(0,0,0,.35)",
              }}
            />
            <div className="absolute inset-0 pointer-events-none rounded-b-xl rounded-t-md bg-gradient-to-br from-white/10 to-transparent" />
          </div>
        </div>

        <div className="flex justify-end px-2 pb-10">
          <a
            href="#topo-historia"
            onClick={(e) => {
              e.preventDefault();
              goTop();
            }}
            className="text-sm font-semibold text-yellow-300 hover:text-yellow-200"
          >
            ↑ Voltar ao topo
          </a>
        </div>
      </div>
    </section>
  );
}
