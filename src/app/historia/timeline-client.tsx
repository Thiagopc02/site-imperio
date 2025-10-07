// src/app/historia/timeline-client.tsx
"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Brand } from "./page";

/**
 * Funcionamento:
 * - Mede a posição (y) do centro de cada seção de história e desenha um path SVG
 *   “meandrando” entre elas, descendo pela página inteira.
 * - O preenchimento (stroke) da mangueira avança até o índice ativo.
 * - Cada bloco mostra o ANO dentro do card, e há um botão “Próxima parte”
 *   sob a imagem que avança para a próxima seção.
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

  // Tema (cores)
  const themeVars: React.CSSProperties = {
    ["--brand" as any]: brand.color,
    ["--brandDark" as any]: brand.dark,
    ["--liquid" as any]: brand.liquid,
  };

  // ------------ refs/medidas p/ mangueira ------------
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sectionsRef = useRef<HTMLDivElement[]>([]);
  sectionsRef.current = [];

  const pushRef = (el: HTMLDivElement | null) => {
    if (el && !sectionsRef.current.includes(el)) {
      sectionsRef.current.push(el);
    }
  };

  const [svgSize, setSvgSize] = useState({ w: 1200, h: 600 });
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);

  // calcula pontos (x alternando para dar "voltas" e y no centro de cada seção)
  const recalc = () => {
    const wrap = wrapperRef.current;
    if (!wrap) return;

    const rectWrap = wrap.getBoundingClientRect();
    const w = rectWrap.width;
    const h = wrap.scrollHeight; // altura total do conteúdo dentro do wrapper
    const centerX = w / 2;
    const ampX = Math.min(180, Math.max(120, w * 0.12)); // amplitude das curvas

    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < sectionsRef.current.length; i++) {
      const s = sectionsRef.current[i];
      const r = s.getBoundingClientRect();
      const centerY = r.top - rectWrap.top + r.height / 2; // relativo ao wrapper
      const x = centerX + (i % 2 === 0 ? -ampX : ampX);
      pts.push({ x, y: centerY });
    }

    // bordas do SVG
    setSvgSize({ w: Math.max(800, w), h: Math.max(h, 400) });
    setPoints(pts);
  };

  // Recalcular em resize/layout
  useLayoutEffect(() => {
    recalc();
    const ro = new ResizeObserver(() => recalc());
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("resize", recalc);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand.slug]);

  // path meândrico descendo e curvando para a “boca do copo” no fim
  const hosePath = useMemo(() => {
    if (!points.length) return "";
    const segs: string[] = [];
    segs.push(`M ${points[0].x} ${points[0].y}`);
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cx = (p0.x + p1.x) / 2;
      segs.push(`C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`);
    }
    // curva final sutil até a borda direita (boca do copo)
    const last = points[points.length - 1];
    const endX = Math.min(svgSize.w - 60, last.x + 140);
    const endY = last.y + 40;
    segs.push(`C ${endX - 120} ${last.y}, ${endX - 40} ${endY}, ${endX} ${endY}`);
    return segs.join(" ");
  }, [points, svgSize.w]);

  // comprimento do path para animar "strokeDashoffset"
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(1);
  useEffect(() => {
    if (pathRef.current) setPathLen(pathRef.current.getTotalLength());
  }, [hosePath]);

  // progresso: até o centro do evento ativo
  const progress = total <= 1 ? 1 : Math.min(1, activeIdx / (total - 1));
  const dashArray = pathLen;
  const dashOffset = Math.max(0, pathLen * (1 - progress));

  // navegação p/ próxima parte
  const goToIdx = (idx: number) => {
    const el = sectionsRef.current[idx];
    if (el) {
      setActiveIdx(idx);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const nextIdx = (idx: number) => Math.min(idx + 1, total - 1);

  // topo
  const goTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <section style={themeVars} className="pb-24">
      {/* Seletor de marcas (mantido) */}
      <div className="container pb-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {brands.map((b) => (
            <button
              key={b.slug}
              onClick={() => {
                setActiveSlug(b.slug);
                setActiveIdx(0);
                goTop();
                // espera layout estabilizar para recalc
                setTimeout(recalc, 50);
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
                <img src={b.logo} alt={b.name} className="object-cover w-full h-full" />
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

      {/* WRAPPER: SVG absoluto descendo por trás de todas as seções */}
      <div ref={wrapperRef} className="container relative">
        {/* SVG da mangueira, cobrindo TODA a altura do wrapper */}
        <svg
          className="absolute inset-0 z-0 pointer-events-none"
          width="100%"
          height={svgSize.h}
          viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
          preserveAspectRatio="none"
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
              <stop offset="100%" stopColor="rgba(255,255,255,0.65)" />
            </linearGradient>
            {/* gradiente do líquido na cor da marca */}
            <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--brandDark)" />
              <stop offset="60%" stopColor="var(--brand)" />
              <stop offset="100%" stopColor="var(--liquid)" />
            </linearGradient>
          </defs>

          {/* tubo translúcido */}
          <path
            d={hosePath}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            filter="url(#softGlow)"
          />
          {/* líquido avançando (cor da marca) */}
          <path
            ref={pathRef}
            d={hosePath}
            stroke="url(#liquidGrad)"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: dashArray,
              strokeDashoffset: dashOffset,
              transition: "stroke-dashoffset 900ms ease",
            }}
            filter="url(#softGlow)"
          />
        </svg>

        {/* LISTA DE SEÇÕES (alternando lados) */}
        <div className="relative z-10 space-y-10">
          {brand.events.map((ev, idx) => {
            const invert = idx % 2 === 1; // alterna lado
            const isActive = idx === activeIdx;
            return (
              <section
                key={ev.id}
                id={ev.id}
                ref={pushRef}
                className={[
                  "grid gap-6 items-center",
                  "md:grid-cols-2",
                  invert ? "md:[&>*:first-child]:order-2" : "",
                  "rounded-2xl p-5 ring-1 ring-white/10",
                  "bg-gradient-to-b from-white/[.02] to-white/[.04]",
                ].join(" ")}
              >
                {/* Texto + ANO dentro do bloco */}
                <div>
                  <div className="inline-flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/15 ring-1 ring-white/20">
                      {ev.year}
                    </span>
                    {isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--brand)]/90 text-white font-semibold">
                        Parte atual
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-extrabold">
                    {ev.year} — {ev.title}
                  </h3>
                  <p className="mt-2 text-white/80">{ev.text}</p>
                  <div className="mt-3 text-[11px] text-white/60">
                    Passo {idx + 1} de {total}
                  </div>
                </div>

                {/* Imagem + botão “Próxima parte” */}
                <div className="w-full max-w-xl justify-self-center">
                  {ev.image ? (
                    <img
                      src={ev.image}
                      alt={`${brand.name} — ${ev.year}`}
                      className="object-contain w-full h-56 bg-white md:h-64 rounded-xl"
                    />
                  ) : (
                    <div className="grid h-56 md:h-64 rounded-xl bg-white/5 ring-1 ring-white/10 place-items-center text-white/50">
                      sem imagem
                    </div>
                  )}

                  <div className="flex justify-end mt-3">
                    <button
                      onClick={() => goToIdx(nextIdx(idx))}
                      className="px-3 py-1.5 text-sm rounded-lg font-semibold bg-[var(--brand)] text-white hover:brightness-110 transition"
                      disabled={idx === total - 1}
                      title={idx === total - 1 ? "Fim da história" : "Ir para a próxima parte"}
                    >
                      Próxima parte
                    </button>
                  </div>
                </div>
              </section>
            );
          })}

          {/* Copo ao final (opcional, decorativo) */}
          <div className="flex justify-center pt-6">
            <div className="relative w-40 h-48">
              <div className="absolute inset-0 rounded-b-xl rounded-t-md ring-2 ring-white/30 bg-white/5 backdrop-blur-[1px]" />
              <div
                className="absolute bottom-0 left-0 right-0 rounded-b-xl transition-[height] duration-900"
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
        </div>
      </div>
    </section>
  );
}
