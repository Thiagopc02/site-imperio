// src/app/historia/timeline-client.tsx
"use client";

import { useMemo, useState } from "react";

type TimelineEvent = {
  id: string;
  year: number;
  title: string;
  text: string;
  image?: string;
};

type Brand = {
  slug: string;
  name: string;
  logo: string;
  banner?: string;
  color: string;
  events: TimelineEvent[];
};

type Props = {
  brands: Brand[];
};

export default function TimelineClient({ brands }: Props) {
  const [active, setActive] = useState<string>(brands[0]?.slug ?? "");

  const activeBrand = useMemo(
    () => brands.find((b) => b.slug === active) ?? brands[0],
    [active, brands]
  );

  const goToTop = () =>
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

  const onPickDate = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      {/* Balões de marcas */}
      <section id="topo-historia" className="container pb-2">
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {brands.map((b) => (
            <button
              key={b.slug}
              onClick={() => {
                setActive(b.slug);
                goToTop();
              }}
              className="group relative rounded-full p-[3px]"
              aria-label={`Ver linha do tempo da ${b.name}`}
              title={`Ver ${b.name}`}
              style={{
                background:
                  b.slug === active
                    ? `radial-gradient(35% 35% at 30% 25%, rgba(255,255,255,.9), rgba(255,255,255,.05)), ${b.color}`
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
      </section>

      {/* Barra de datas (timeline) */}
      <section className="container mt-10">
        <div className="relative overflow-x-auto">
          <div className="min-w-[720px] w-full">
            {/* Linha */}
            <div className="w-full h-1 rounded bg-white/10" />
            {/* Marcadores */}
            <div className="relative flex gap-6 -mt-3 md:gap-10">
              {activeBrand.events.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onPickDate(ev.id)}
                  className="flex flex-col items-center pt-3 group"
                  title={`Ir para ${ev.year}`}
                >
                  <span className="size-3 rounded-full bg-red-600 shadow-[0_0_14px_rgba(225,6,0,.8)] group-hover:scale-110 transition" />
                  <span className="mt-2 text-xs text-gray-300 md:text-sm group-hover:text-white">
                    {ev.year}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Seções da timeline */}
      <section className="container mt-8 space-y-10">
        {activeBrand.events.map((ev, idx) => (
          <article
            id={ev.id}
            key={ev.id}
            className="grid items-center grid-cols-1 gap-6 p-5 shadow-xl md:grid-cols-3 bg-neutral-900 rounded-2xl ring-1 ring-white/5"
          >
            {ev.image ? (
              <>
                <img
                  src={ev.image}
                  alt={`${activeBrand.name} — ${ev.year}`}
                  className="object-contain w-full h-48 bg-white md:h-52 rounded-xl"
                />
                <div className="md:col-span-2">
                  <h3 className="text-xl font-bold">
                    {ev.year} — {ev.title}
                  </h3>
                  <p className="mt-2 text-gray-300">{ev.text}</p>
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-3">
                  <h3 className="text-xl font-bold">
                    {ev.year} — {ev.title}
                  </h3>
                  <p className="mt-2 text-gray-300">{ev.text}</p>
                </div>
              </>
            )}

            {/* etiqueta do passo */}
            <div className="md:col-span-3">
              <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                Passo {idx + 1} de {activeBrand.events.length}
              </span>
            </div>
          </article>
        ))}

        {/* Voltar topo */}
        <div className="flex justify-end px-2 pb-10">
          <a
            href="#topo-historia"
            onClick={(e) => {
              e.preventDefault();
              goToTop();
            }}
            className="text-sm font-semibold text-yellow-300 hover:text-yellow-200"
          >
            ↑ Voltar ao topo
          </a>
        </div>
      </section>
    </>
  );
}
