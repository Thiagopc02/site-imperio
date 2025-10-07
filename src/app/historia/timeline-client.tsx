// src/app/historia/timeline-client.tsx
"use client";

import { useMemo, useState } from "react";
import type { Brand } from "./page";

type Props = { brands: Brand[] };

export default function TimelineClient({ brands }: Props) {
  const [active, setActive] = useState<string>(brands[0]?.slug ?? "");
  const activeBrand = useMemo(
    () => brands.find((b) => b.slug === active) ?? brands[0],
    [active, brands]
  );

  // progresso: ids que o usuário já “visitou”
  const [visited, setVisited] = useState<Set<string>>(new Set());

  const total = activeBrand.events.length;
  const done = activeBrand.events.filter((e) => visited.has(e.id)).length;
  const progress = total === 0 ? 0 : Math.min(1, done / total);

  const themeVars = {
    // variáveis CSS aplicadas na raiz desta seção
    ["--brand" as any]: activeBrand.color,
    ["--brandDark" as any]: activeBrand.dark,
    ["--liquid" as any]: activeBrand.liquid,
  };

  const markVisited = (id: string) =>
    setVisited((prev) => {
      if (prev.has(id)) return prev;
      const n = new Set(prev);
      n.add(id);
      return n;
    });

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // marca como visto logo após um pequeno atraso (para não “pular” no clique)
    setTimeout(() => markVisited(id), 150);
  };

  const goTop = () =>
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

  return (
    <section
      className="pb-24"
      style={themeVars}
    >
      {/* Balões de marcas */}
      <div id="topo-historia" className="container pb-2">
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {brands.map((b) => (
            <button
              key={b.slug}
              onClick={() => {
                setActive(b.slug);
                goTop();
              }}
              className="group relative rounded-full p-[3px]"
              aria-label={`Ver linha do tempo da ${b.name}`}
              title={`Ver ${b.name}`}
              style={{
                background:
                  b.slug === active
                    ? `radial-gradient(35% 35% at 30% 25%, rgba(255,255,255,.9), rgba(255,255,255,.05)), var(--brand)`
                    : "linear-gradient(180deg, #1f2937 0%, #111827 100%)",
              }}
            >
              <span
                className="block overflow-hidden rounded-full shadow-lg size-20 md:size-24 ring-2 ring-white/20"
                style={{
                  boxShadow:
                    b.slug === active
                      ? "0 12px 40px rgba(225,6,0,.45)"
                      : "0 12px 28px rgba(0,0,0,.35)",
                }}
              >
                <img
                  src={b.logo}
                  alt={b.name}
                  className="object-cover w-full h-full"
                />
              </span>
              {b.slug === active && (
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[11px] rounded-full bg-white/90 text-black font-semibold shadow">
                  {b.name}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Mangueira/progresso */}
      <div className="container mt-6">
        <div className="relative h-4 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
          {/* “tubo” translúcido */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/20" />
          {/* preenchimento (líquido) */}
          <div
            className="relative h-full transition-[width] duration-700"
            style={{
              width: `${progress * 100}%`,
              background:
                "linear-gradient(90deg, var(--brandDark) 0%, var(--brand) 60%, var(--liquid) 100%)",
              boxShadow:
                "0 0 18px rgba(225,6,0,.45), inset 0 0 12px rgba(0,0,0,.35)",
            }}
          />
          {/* dica quando ainda há datas a clicar */}
          {progress < 1 && (
            <span className="absolute right-2 -top-7 text-[11px] text-white/80 animate-pulse">
              clique nas datas para “encher”
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-white/70">
          Progresso: {(progress * 100).toFixed(0)}% ({done}/{total})
        </div>
      </div>

      {/* Barra de datas (timeline) */}
      <div className="container mt-8">
        <div className="relative overflow-x-auto">
          <div className="min-w-[760px] w-full">
            {/* linha base */}
            <div className="w-full h-1 rounded bg-white/10" />
            {/* marcadores */}
            <div className="relative flex gap-6 -mt-3 md:gap-10">
              {activeBrand.events.map((ev) => {
                const seen = visited.has(ev.id);
                return (
                  <button
                    key={ev.id}
                    onClick={() => scrollTo(ev.id)}
                    className="flex flex-col items-center pt-3 group"
                    title={`Ir para ${ev.year}`}
                  >
                    <span
                      className={[
                        "size-3 rounded-full transition-transform",
                        seen
                          ? "bg-[var(--brand)] shadow-[0_0_14px_rgba(225,6,0,.8)]"
                          : "bg-white/40 group-hover:scale-110",
                      ].join(" ")}
                    />
                    <span className="mt-2 text-xs text-gray-300 md:text-sm group-hover:text-white">
                      {ev.year}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Seções da timeline */}
      <div className="container mt-8 space-y-10">
        {activeBrand.events.map((ev, idx) => (
          <article
            id={ev.id}
            key={ev.id}
            className="grid items-center grid-cols-1 gap-6 p-5 shadow-xl md:grid-cols-3 rounded-2xl ring-1 ring-white/5"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.04) 100%)",
            }}
          >
            {ev.image ? (
              <>
                <img
                  src={ev.image}
                  alt={`${activeBrand.name} — ${ev.year}`}
                  className="object-contain w-full h-48 bg-white md:h-56 rounded-xl"
                  onLoad={() => markVisited(ev.id)}
                />
                <div className="md:col-span-2">
                  <h3 className="text-xl font-extrabold">
                    {ev.year} — {ev.title}
                  </h3>
                  <p className="mt-2 text-gray-300">{ev.text}</p>
                </div>
              </>
            ) : (
              <div className="md:col-span-3">
                <h3 className="text-xl font-extrabold">
                  {ev.year} — {ev.title}
                </h3>
                <p className="mt-2 text-gray-300">{ev.text}</p>
              </div>
            )}

            <div className="md:col-span-3">
              <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                Passo {idx + 1} de {activeBrand.events.length}
              </span>
            </div>
          </article>
        ))}

        {/* Copo: aparece completo quando 100% */}
        <div className="flex justify-center pt-6">
          <div className="relative w-40 h-48">
            {/* copo (contorno) */}
            <div className="absolute inset-0 rounded-b-xl rounded-t-md ring-2 ring-white/30 bg-white/5 backdrop-blur-[1px]" />
            {/* líquido preenchendo */}
            <div
              className="absolute bottom-0 left-0 right-0 rounded-b-xl transition-[height] duration-700"
              style={{
                height: `${progress * 100}%`,
                background:
                  "linear-gradient(180deg, var(--brand) 0%, var(--liquid) 70%)",
                boxShadow: "inset 0 8px 18px rgba(0,0,0,.35)",
              }}
            />
            {/* brilho do copo */}
            <div className="absolute inset-0 pointer-events-none rounded-b-xl rounded-t-md bg-gradient-to-br from-white/10 to-transparent" />
          </div>
        </div>

        {progress === 1 && (
          <p className="mt-2 text-sm text-center text-white/90">
            🥂 Linha do tempo completa! Copo cheio de {activeBrand.name}.
          </p>
        )}

        {/* Voltar topo */}
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
