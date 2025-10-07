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

type Props = { brands: Brand[] };

export default function TimelineClient({ brands }: Props) {
  const [activeSlug, setActiveSlug] = useState(brands[0]?.slug ?? "");
  const brand = useMemo(
    () => brands.find((b) => b.slug === activeSlug) ?? brands[0],
    [activeSlug, brands]
  );

  const total = brand.events.length;
  const [activeIdx, setActiveIdx] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [modalShownOnce, setModalShownOnce] = useState(false);

  const themeVars: React.CSSProperties = {
    ["--brand" as any]: brand.color,
    ["--brandDark" as any]: brand.dark,
    ["--liquid" as any]: brand.liquid,
  };

  // ---------- path da mangueira (descendo) ----------
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sectionsRef = useRef<HTMLDivElement[]>([]);
  useEffect(() => {
    sectionsRef.current = [];
  }, [brand.slug]);

  const captureSectionRef = (el: HTMLDivElement | null): void => {
    if (el && !sectionsRef.current.includes(el)) sectionsRef.current.push(el);
  };

  const [svgSize, setSvgSize] = useState({ w: 1200, h: 600 });
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);

  const recalc = (): void => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();

    const w = rect.width;
    const h = wrap.scrollHeight;
    const centerX = w / 2;
    const ampX = Math.min(200, Math.max(140, w * 0.14)); // um pouco maior p/ curvas mais amplas

    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < sectionsRef.current.length; i++) {
      const s = sectionsRef.current[i];
      const r = s.getBoundingClientRect();
      const cy = r.top - rect.top + r.height / 2;
      const x = centerX + (i % 2 === 0 ? -ampX : ampX);
      pts.push({ x, y: cy });
    }
    setSvgSize({ w: Math.max(900, w), h: Math.max(h, 480) });
    setPoints(pts);
  };

  useLayoutEffect(() => {
    recalc();
    const canObserve =
      typeof window !== "undefined" &&
      typeof (window as any).ResizeObserver !== "undefined";
    let ro: ResizeObserver | null = null;
    if (canObserve && wrapperRef.current) {
      ro = new ResizeObserver(() => recalc());
      ro.observe(wrapperRef.current);
    }
    const onResize = () => recalc();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand.slug]);

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
    const last = points[points.length - 1];
    const endX = Math.min(svgSize.w - 60, last.x + 160);
    const endY = last.y + 44;
    segs.push(`C ${endX - 120} ${last.y}, ${endX - 40} ${endY}, ${endX} ${endY}`);
    return segs.join(" ");
  }, [points, svgSize.w]);

  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(1);
  useEffect(() => {
    if (pathRef.current) setPathLen(pathRef.current.getTotalLength());
  }, [hosePath]);

  const progress = total <= 1 ? 1 : Math.min(1, activeIdx / (total - 1));
  const dashArray = pathLen;
  const dashOffset = Math.max(0, pathLen * (1 - progress));

  useEffect(() => {
    if (activeIdx === total - 1 && !modalShownOnce) {
      const t = setTimeout(() => {
        setShowModal(true);
        setModalShownOnce(true);
      }, 950);
      return () => clearTimeout(t);
    }
  }, [activeIdx, total, modalShownOnce]);

  const goToIdx = (idx: number) => {
    const el = sectionsRef.current[idx];
    if (el) {
      setActiveIdx(idx);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const nextIdx = (idx: number) => Math.min(idx + 1, total - 1);
  const goTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const brandIndex = brands.findIndex((b) => b.slug === brand.slug);
  const nextBrand =
    brands.length > 1 && brandIndex !== -1
      ? brands[(brandIndex + 1) % brands.length]
      : null;

  const handleReverHistoria = () => {
    setShowModal(false);
    setModalShownOnce(false);
    goTop();
    setTimeout(() => goToIdx(0), 150);
  };
  const handleIrParaProxima = () => {
    if (nextBrand) {
      setShowModal(false);
      setModalShownOnce(false);
      setActiveSlug(nextBrand.slug);
      setActiveIdx(0);
      goTop();
      setTimeout(recalc, 80);
    } else {
      handleReverHistoria();
    }
  };

  return (
    <section className="pb-24" style={themeVars}>
      {/* Seletor de marcas — MAIOR */}
      <div className="container pb-10">
        <div className="flex flex-wrap items-end justify-center gap-14">
          {brands.map((b) => {
            const isActive = b.slug === brand.slug;
            return (
              <button
                key={b.slug}
                onClick={() => {
                  setActiveSlug(b.slug);
                  setActiveIdx(0);
                  setShowModal(false);
                  setModalShownOnce(false);
                  goTop();
                  setTimeout(recalc, 50);
                }}
                className="relative group"
                aria-label={`Ver ${b.name}`}
                title={`Ver ${b.name}`}
              >
                {/* Plaquinha acima — maior e mais “bold” */}
                <span
                  className={[
                    "absolute -top-12 left-1/2 -translate-x-1/2",
                    "px-4 py-1.5 rounded-full shadow-xl ring-1 ring-black/10",
                    "text-sm md:text-base font-extrabold tracking-tight",
                    isActive ? "bg-white text-black" : "bg-white/90 text-black",
                  ].join(" ")}
                >
                  {b.name}
                </span>

                {/* Orbe bem maior, com borda e glow */}
                <span
                  className={[
                    "block size-28 md:size-32 rounded-full transition-transform",
                    "ring-4 ring-white/35 ring-offset-2 ring-offset-black shadow-[0_20px_60px_rgba(0,0,0,.45)]",
                    "group-hover:scale-105",
                  ].join(" ")}
                  style={{
                    background: isActive
                      ? `radial-gradient(35% 35% at 30% 25%, rgba(255,255,255,.9), rgba(255,255,255,.05)), var(--brand)`
                      : "linear-gradient(180deg, #1f2937 0%, #111827 100%)",
                    boxShadow: isActive
                      ? "0 22px 70px rgba(225,6,0,.45)"
                      : "0 16px 44px rgba(0,0,0,.35)",
                  }}
                />

                {/* Logo inferior — bem maior */}
                <span className="absolute px-3 py-2 -translate-x-1/2 rounded-full shadow-xl -bottom-12 left-1/2 bg-white/95 ring-1 ring-black/5">
                  <img
                    src={b.badgeLogo}
                    alt={`${b.name} logo`}
                    className="object-contain w-auto h-12" // ~48px de altura
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mangueira + seções + copo + modal */}
      <div ref={wrapperRef} className="container relative">
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
            <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--brandDark)" />
              <stop offset="60%" stopColor="var(--brand)" />
              <stop offset="100%" stopColor="var(--liquid)" />
            </linearGradient>
          </defs>

          <path
            d={hosePath}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="16"
            fill="none"
            strokeLinecap="round"
            filter="url(#softGlow)"
          />
          <path
            ref={pathRef}
            d={hosePath}
            stroke="url(#liquidGrad)"
            strokeWidth="16"
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

        <div className="relative z-10 space-y-10">
          {brand.events.map((ev, idx) => {
            const invert = idx % 2 === 1;
            const isActive = idx === activeIdx;
            return (
              <section
                id={ev.id}
                key={ev.id}
                ref={captureSectionRef}
                className={[
                  "grid items-center gap-6 md:grid-cols-2",
                  invert ? "md:[&>*:first-child]:order-2" : "",
                  "rounded-2xl p-5 ring-1 ring-white/10",
                  "bg-gradient-to-b from-white/[.02] to-white/[.04]",
                ].join(" ")}
              >
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

          {/* Copo final preenchendo */}
          <div className="flex justify-center pt-6">
            <div className="relative h-56 w-44">
              <div className="absolute inset-0 rounded-b-xl rounded-t-md ring-2 ring-white/30 bg-white/5 backdrop-blur-[1px]" />
              <div
                className="absolute bottom-0 left-0 right-0 rounded-b-xl transition-[height] duration-900"
                style={{
                  height: `${Math.min(100, progress * 100)}%`,
                  background:
                    "linear-gradient(180deg, var(--brand) 0%, var(--liquid) 70%)",
                  boxShadow: "inset 0 8px 18px rgba(0,0,0,.35)",
                }}
              />
              <div className="absolute inset-0 pointer-events-none rounded-b-xl rounded-t-md bg-gradient-to-br from-white/10 to-transparent" />
            </div>
          </div>

          {/* Modal final */}
          {showModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
              role="dialog"
              aria-modal="true"
            >
              <div className="relative w-full max-w-md text-white shadow-2xl rounded-2xl bg-neutral-900 ring-1 ring-white/10">
                <div className="p-5">
                  <h4 className="text-xl font-bold">🎉 Parabéns!</h4>
                  <p className="mt-2 text-white/80">
                    Você chegou ao fim desta história. Quer rever desde o início
                    ou seguir para a próxima?
                  </p>
                  <div className="flex items-center justify-end gap-3 mt-5">
                    <button
                      onClick={handleReverHistoria}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/15"
                    >
                      Rever História
                    </button>
                    <button
                      onClick={handleIrParaProxima}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[var(--brand)] text-white hover:brightness-110"
                    >
                      Ir para Próxima
                    </button>
                  </div>
                </div>
                <button
                  aria-label="Fechar"
                  onClick={() => setShowModal(false)}
                  className="absolute top-3 right-4 text-white/60 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
