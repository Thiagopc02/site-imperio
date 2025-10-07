'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LuCrown } from 'react-icons/lu';

/* =========================
   Tipos
   ========================= */
type YearItem = {
  ano: number;
  titulo: string;
  texto: string;
};

type Marca = {
  id: string;
  nome: string;
  resumo: string;
  timeline: YearItem[];
};

/* =========================
   Dados — Coca-Cola (somente MARCA, sem produtos)
   ========================= */
const COCA_COLA: Marca = {
  id: 'coca-cola',
  nome: 'Coca-Cola',
  resumo:
    'Criada em 1886 por John Pemberton, em Atlanta (EUA), a Coca-Cola tornou-se um dos símbolos culturais mais reconhecidos do planeta, moldando publicidade, design e patrocínios esportivos por mais de um século.',
  timeline: [
    {
      ano: 1886,
      titulo: 'A fórmula original',
      texto:
        'John S. Pemberton cria o xarope que daria origem à Coca-Cola. A bebida começa a ser vendida na farmácia Jacobs, em Atlanta.',
    },
    {
      ano: 1892,
      titulo: 'The Coca-Cola Company',
      texto:
        'Asa Griggs Candler consolida a empresa e inicia a expansão, investindo pesado em marca e distribuição.',
    },
    {
      ano: 1915,
      titulo: 'Design da garrafa “contour”',
      texto:
        'O desenho icônico nasce para ser reconhecido até no escuro ou mesmo quebrado — um marco de design industrial.',
    },
    {
      ano: 1928,
      titulo: 'Jogos Olímpicos',
      texto:
        'Primeiro grande patrocínio olímpico da marca, iniciando uma história duradoura com o esporte mundial.',
    },
    {
      ano: 1941,
      titulo: 'Segunda Guerra e expansão global',
      texto:
        'Engarrafadoras acompanham as tropas americanas; no pós-guerra a rede permanece e acelera a presença internacional.',
    },
    {
      ano: 1971,
      titulo: '“I’d Like to Buy the World a Coke”',
      texto:
        'Um dos comerciais mais famosos da história, símbolo da mensagem de união da marca nos anos 70.',
    },
    {
      ano: 1985,
      titulo: 'New Coke',
      texto:
        'A reformulação da fórmula gera reação do público; a “Coca-Cola Classic” retorna e reforça o vínculo emocional com consumidores.',
    },
    {
      ano: 2005,
      titulo: 'Coca-Cola Zero',
      texto:
        'Nova plataforma sem açúcar, expandindo o portfólio com foco em sabor e menos calorias.',
    },
    {
      ano: 2016,
      titulo: 'Taste The Feeling',
      texto:
        'Reposicionamento global unifica a comunicação das diferentes variantes sob um mesmo guarda-chuva emocional.',
    },
  ],
};

const sectionId = (marcaId: string, ano: number) => `${marcaId}-${ano}`;

export const metadata = {
  title: 'História — Coca-Cola | Império',
  description:
    'Linha do tempo da Coca-Cola: marcos, curiosidades e capítulos que moldaram uma das marcas mais famosas do mundo.',
};

export default function HistoriaPage() {
  const [marca] = useState<Marca>(COCA_COLA);
  const [anoAtivo, setAnoAtivo] = useState<number>(COCA_COLA.timeline[0].ano);

  // map de refs por seção/ano
  const refsPorAno = useRef<Record<string, HTMLDivElement | null>>({});

  const anos = useMemo(
    () => [...marca.timeline].sort((a, b) => a.ano - b.ano).map((i) => i.ano),
    [marca]
  );

  useEffect(() => {
    setAnoAtivo(marca.timeline[0].ano);
  }, [marca]);

  const handleClickAno = (ano: number) => {
    setAnoAtivo(ano);
    const key = sectionId(marca.id, ano);
    const el = refsPorAno.current[key];
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="min-h-screen text-white bg-black">
      {/* Título */}
      <section className="container pt-10">
        <h1 className="mb-6 text-3xl font-extrabold text-center md:text-4xl">
          <span className="inline-flex items-center gap-2">
            <LuCrown className="text-yellow-400" size={26} />
            História da {marca.nome}
            <LuCrown className="text-yellow-400" size={26} />
          </span>
        </h1>

        <p className="max-w-4xl mx-auto mb-6 text-center text-gray-300">
          Explore os principais marcos da {marca.nome}. Clique em uma data na
          linha do tempo para ir direto ao capítulo correspondente.
        </p>
      </section>

      {/* Balão da MARCA (sem produtos) */}
      <section className="container" id="topo-historia">
        <div className="flex items-center justify-center pb-4">
          <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full p-[3px] bg-gradient-to-b from-red-400 to-red-600">
            <span className="grid w-full h-full overflow-hidden rounded-full ring-2 ring-red-300/80 bg-zinc-950 place-items-center">
              {/* Em vez de imagem de produto, um selo tipográfico da marca */}
              <span className="text-xl font-extrabold tracking-wide text-white md:text-2xl">
                Coca-Cola
              </span>
            </span>
            {/* brilho */}
            <span className="absolute w-3 h-3 bg-white rounded-full top-2 right-3 opacity-90" />
          </div>
        </div>
      </section>

      {/* Capa neutra + resumo (sem fotos de produto) */}
      <section className="container pt-6">
        <div className="grid items-center grid-cols-1 gap-6 md:grid-cols-[320px,1fr]">
          <div className="grid h-56 overflow-hidden rounded-2xl ring-1 ring-zinc-700/60 bg-gradient-to-b from-zinc-800 to-zinc-900 md:h-64 place-items-center">
            <span className="text-4xl font-extrabold text-red-400">Coca-Cola</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold">{marca.nome}</h2>
            <p className="mt-2 text-gray-300">{marca.resumo}</p>
          </div>
        </div>
      </section>

      {/* Linha do tempo — anos */}
      <section className="container pt-10">
        <div className="rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 p-4 ring-1 ring-zinc-700/60 shadow-[inset_0_8px_16px_rgba(255,255,255,0.05),0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            {anos.map((ano) => {
              const ativo = anoAtivo === ano;
              return (
                <button
                  key={ano}
                  onClick={() => handleClickAno(ano)}
                  className={[
                    'relative px-4 py-2 rounded-full text-sm md:text-base whitespace-nowrap transition focus:outline-none',
                    ativo
                      ? 'bg-yellow-400 text-black font-extrabold ring-2 ring-yellow-300'
                      : 'bg-zinc-700 text-white hover:bg-zinc-600',
                  ].join(' ')}
                  aria-pressed={ativo}
                >
                  {ano}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Capítulos por ano */}
      <section className="container py-10">
        <div className="grid grid-cols-1 gap-8">
          {marca.timeline
            .sort((a, b) => a.ano - b.ano)
            .map((item) => {
              const key = sectionId(marca.id, item.ano);
              return (
                <div
                  key={key}
                  id={key}
                  ref={(el) => {
                    // <<< correção: não retornar o 'el'; apenas setar no map (retorno void)
                    refsPorAno.current[key] = el;
                  }}
                  className="overflow-hidden shadow-xl rounded-2xl bg-neutral-900 ring-1 ring-zinc-700/60"
                >
                  <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center">
                    {/* Badge do ano */}
                    <div className="shrink-0">
                      <div className="px-4 py-2 font-extrabold text-black bg-yellow-400 rounded-full ring-2 ring-yellow-300">
                        {item.ano}
                      </div>
                    </div>

                    {/* Texto */}
                    <div className="grow">
                      <h3 className="text-xl font-semibold">{item.titulo}</h3>
                      <p className="mt-2 text-gray-300">{item.texto}</p>
                    </div>
                  </div>

                  <div className="flex justify-end px-6 pb-6">
                    <a
                      href="#topo-historia"
                      onClick={(e) => {
                        e.preventDefault();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-sm font-semibold text-yellow-300 hover:text-yellow-200"
                    >
                      Voltar ao topo ↑
                    </a>
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </main>
  );
}
