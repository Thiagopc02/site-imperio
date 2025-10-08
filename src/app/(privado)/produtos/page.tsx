'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import { useCart } from '@/context/CartContext';

type Produto = {
  id: string;
  nome: string;
  precoUnidade?: number;
  precoCaixa?: number;
  itensPorCaixa?: number;
  descrição: string;
  imagem: string;       // "coca-zero-2l.png" ou "/produtos/coca-zero-2l.png"
  categoria: string;    // "Refrescos e Sucos", etc.
  destaque: boolean;
  disponivelPor?: string[];
  emFalta?: boolean;
};

const NOV_KEY = '__novidades__';
const COPAO_CAT = 'Copão de 770ml';

/** Botão NOVIDADE — degradê rosa→azul com brilho */
function NovidadeButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Novidades"
      className={[
        'relative inline-flex items-center justify-center',
        'px-4 py-2 rounded-lg text-sm font-bold text-white select-none',
        'transition ring-2 focus:outline-none',
        active ? 'ring-yellow-400' : 'ring-transparent',
      ].join(' ')}
      style={{
        width: 180,
        height: 48,
        background: 'linear-gradient(135deg, #ff48b0 0%, #8c6cff 45%, #42a5ff 100%)',
        boxShadow:
          '0 0 14px rgba(66,165,255,.55), 0 0 28px rgba(255,72,176,.35), inset 0 0 10px rgba(255,255,255,.12)',
      }}
    >
      <span
        className="px-3 py-1 font-extrabold tracking-wider text-black bg-white rounded-md drop-shadow"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,.15), 0 0 8px rgba(255,255,255,.45)' }}
      >
        NOVIDADE
      </span>
      <span
        aria-hidden
        className="absolute inset-0 transition rounded-lg opacity-0 pointer-events-none hover:opacity-100"
        style={{
          background: 'radial-gradient(80% 60% at 50% 50%, rgba(66,165,255,.28), transparent 60%)',
          filter: 'blur(10px)',
        }}
      />
    </button>
  );
}

/** Botão especial “Copão de 770ml” */
function CopaoButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Copão de 770ml"
      className={[
        'relative inline-flex items-center justify-center',
        'px-4 py-2 rounded-xl select-none transition ring-2 focus:outline-none',
        active ? 'ring-yellow-400' : 'ring-transparent',
      ].join(' ')}
      style={{
        width: 200,
        height: 52,
        background: 'linear-gradient(135deg, #0ea5e9 0%, #22c55e 55%, #f59e0b 100%)',
        boxShadow: '0 10px 26px rgba(14,165,233,.35), inset 0 0 12px rgba(255,255,255,.18)',
      }}
    >
      <span
        className="flex items-center gap-2 text-white"
        style={{
          fontWeight: 900,
          letterSpacing: 0.4,
          textShadow: '0 2px 0 #0f172a, 0 4px 0 rgba(0,0,0,.35), 0 6px 12px rgba(0,0,0,.45)',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.35))',
        }}
      >
        🥤
        <span
          style={{ transform: 'translateY(-1px)', WebkitTextStroke: '0.5px rgba(255,255,255,.22)' }}
          className="text-sm md:text-base"
        >
          COPÃO DE <span className="whitespace-nowrap">770ml</span>
        </span>
      </span>
      <span
        aria-hidden
        className="absolute inset-0 transition opacity-0 pointer-events-none rounded-xl hover:opacity-100"
        style={{
          background: 'radial-gradient(70% 60% at 50% 45%, rgba(255,255,255,.18), transparent 60%)',
          filter: 'blur(8px)',
        }}
      />
    </button>
  );
}

/* ---------- utils: marca e volume ---------- */

/** Deduz a “marca” a partir do nome (flexível) */
function inferirMarca(nome: string): string {
  const n = (nome || '').toLowerCase();
  const regras: [string, RegExp][] = [
    ['Coca Cola', /\b(coca[\s-]?cola|coca)\b/],
    ['Guaraná Antarctica', /\b(guaran[aá][\s-]?antarctica|guaran[aá])\b/],
    ['H2OH!', /\bh2oh!?/],
    ['Schweppes', /\bschweppes\b/],
    ['Fanta', /\bfanta\b/],
    ['Sprite', /\bsprite\b/],
    ['Monster', /\bmonster\b/],
    ['Água Crystal', /\b(crystal|cristal)\b/],
  ];
  for (const [marca, regex] of regras) if (regex.test(n)) return marca;
  const primeira = (nome || '').trim().split(/\s+/)[0];
  return primeira ? primeira.charAt(0).toUpperCase() + primeira.slice(1) : 'Outras';
}

/** Extrai um volume aproximado em ML a partir do nome (2L, 1,5L, 310ml, 500 ML, etc.) */
function extrairVolumeMl(nome: string): number {
  const n = (nome || '').toLowerCase().replace(',', '.').replace(/\s+/g, '');
  const litro = n.match(/(\d+(?:\.\d+)?)l/);
  const ml = n.match(/(\d+)\s?ml/);
  if (litro) {
    const v = parseFloat(litro[1]);
    if (!Number.isNaN(v)) return Math.round(v * 1000);
  }
  if (ml) {
    const v = parseInt(ml[1], 10);
    if (!Number.isNaN(v)) return v;
  }
  const qualquer = n.match(/(\d+(?:\.\d+)?)/);
  if (qualquer) {
    const v = parseFloat(qualquer[1]);
    if (v > 10) return Math.round(v);      // supõe ml (ex.: 600 -> 600 ml)
    if (v > 0) return Math.round(v * 1000); // supõe L (ex.: 2 -> 2000 ml)
  }
  return 0;
}

/* ------------------------------------------ */

export default function ProdutosPage() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [quantidade, setQuantidade] = useState<Record<string, number>>({});
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>(''); // pode ficar vazia
  const [marcaSelecionada, setMarcaSelecionada] = useState<string>('');        // idem
  const [tipoSelecionado, setTipoSelecionado] = useState<Record<string, string>>({});
  const { adicionarAoCarrinho } = useCart();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
      else carregarProdutos();
    });
    return () => unsub();
  }, [router]);

  const carregarProdutos = async () => {
    const qs = await getDocs(collection(db, 'produtos'));
    const lista: Produto[] = [];
    qs.forEach((docx) => {
      const data = docx.data() as any;
      lista.push({
        id: docx.id,
        nome: data.nome,
        precoUnidade: data.precoUnidade,
        precoCaixa: data.precoCaixa,
        itensPorCaixa: data.itensPorCaixa,
        descrição: data.descrição,
        imagem: data.imagem,
        categoria: data.categoria,
        destaque: !!data.destaque,
        disponivelPor: data.disponivelPor || ['unidade'],
        emFalta: !!data.emFalta,
      });
    });
    setProdutos(lista);
  };

  const alterarQuantidade = (id: string, delta: number) => {
    setQuantidade((prev) => ({ ...prev, [id]: Math.max((prev[id] || 0) + delta, 0) }));
  };

  const handleAdicionar = (produto: Produto) => {
    if (produto.emFalta) return;
    const tipo = tipoSelecionado[produto.id] || 'unidade';
    const preco = tipo === 'caixa' ? produto.precoCaixa ?? 0 : produto.precoUnidade ?? 0;
    adicionarAoCarrinho({ ...produto, tipo, preco, quantidade: quantidade[produto.id] || 1 });
    setQuantidade((prev) => ({ ...prev, [produto.id]: 0 }));
  };

  // Categorias (Copão & Novidade continuam funcionando)
  const categorias = [
    { nome: 'Refrescos e Sucos', emoji: '🧃' },
    { nome: 'Fermentados', emoji: '🍺' },
    { nome: 'Destilados', emoji: '🥃' },
    { nome: 'Adega', emoji: '🍷' },
    { nome: 'Águas', emoji: '💧' },
    { nome: 'Balas e Gomas', emoji: '🍬' },
    { nome: 'Chocolates', emoji: '🍫' },
  ];

  // Base filtrada por categoria/novidade — se nenhuma selecionada, usa TODOS
  const baseFiltrada = useMemo(() => {
    let base = produtos;
    if (categoriaSelecionada === NOV_KEY) base = base.filter((p) => p.destaque);
    else if (categoriaSelecionada === COPAO_CAT) base = base.filter((p) => p.categoria === COPAO_CAT);
    else if (categoriaSelecionada) base = base.filter((p) => p.categoria === categoriaSelecionada);
    return base;
  }, [produtos, categoriaSelecionada]);

  // Grupos por marca, ordenados por volume desc; se marcaSelecionada setada, mostra só ela
  const gruposPorMarca = useMemo(() => {
    const lista = marcaSelecionada
      ? baseFiltrada.filter((p) => inferirMarca(p.nome) === marcaSelecionada)
      : baseFiltrada;

    const mapa = new Map<string, Produto[]>();
    for (const p of lista) {
      const marca = inferirMarca(p.nome);
      if (!mapa.has(marca)) mapa.set(marca, []);
      mapa.get(marca)!.push(p);
    }

    for (const [_, arr] of mapa) {
      arr.sort((a, b) => {
        const va = extrairVolumeMl(a.nome);
        const vb = extrairVolumeMl(b.nome);
        if (vb !== va) return vb - va; // maior ml primeiro
        return a.nome.localeCompare(b.nome);
      });
    }

    // ordem das marcas: alfabética
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [baseFiltrada, marcaSelecionada]);

  const limparFiltros = () => {
    setCategoriaSelecionada('');
    setMarcaSelecionada('');
  };

  // chips de marcas para filtrar rapidamente
  const marcasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    baseFiltrada.forEach((p) => set.add(inferirMarca(p.nome)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [baseFiltrada]);

  const imgSrcFrom = (produto: Produto) =>
    produto.imagem?.startsWith('http') || produto.imagem?.startsWith('/')
      ? produto.imagem
      : `/produtos/${produto.imagem}`;

  const tituloSecao = (marca: string) => `Refrigerantes ${marca}`;

  return (
    <main className="min-h-screen px-4 py-8 text-white bg-black">
      <div className="max-w-6xl mx-auto">
        {/* Frase acima de CATEGORIAS */}
        <p className="mb-2 text-sm text-center text-zinc-300">
          Produtos já organizados por marca — do MAIOR para o MENOR volume (ml).
        </p>

        <h1 className="text-4xl sm:text-5xl md:text-6xl text-center font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 via-orange-600 to-red-600 mb-6 drop-shadow-[2px_2px_2px_#ff0000]">
          CATEGORIAS
        </h1>

        {/* Barra de categorias */}
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {categorias.map((cat) => (
            <button
              key={cat.nome}
              className={`px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition text-white text-sm font-medium flex items-center gap-2 ${
                categoriaSelecionada === cat.nome ? 'ring-2 ring-yellow-400' : ''
              }`}
              onClick={() => setCategoriaSelecionada(cat.nome)}
            >
              <span>{cat.emoji}</span>
              {cat.nome}
            </button>
          ))}
          <CopaoButton
            active={categoriaSelecionada === COPAO_CAT}
            onClick={() => setCategoriaSelecionada(COPAO_CAT)}
          />
          <NovidadeButton
            active={categoriaSelecionada === NOV_KEY}
            onClick={() => setCategoriaSelecionada(NOV_KEY)}
          />
        </div>

        {/* Barra de marcas (funciona para QUALQUER categoria escolhida) */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {marcasDisponiveis.map((m) => (
            <button
              key={m}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                marcaSelecionada === m
                  ? 'bg-yellow-400 text-black border-yellow-400'
                  : 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'
              }`}
              onClick={() => setMarcaSelecionada(m)}
              aria-pressed={marcaSelecionada === m}
            >
              {m}
            </button>
          ))}

          {(marcaSelecionada || categoriaSelecionada) && (
            <button
              onClick={limparFiltros}
              className="px-3 py-1.5 rounded-full text-sm bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-600"
              title="Limpar filtros"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* AGRUPAMENTOS — já aparecem assim na ABERTURA da página */}
        {gruposPorMarca.length === 0 ? (
          <p className="font-semibold text-center text-red-400">Nenhum produto encontrado.</p>
        ) : (
          gruposPorMarca.map(([marca, itens]) => (
            <section key={marca} className="mb-10">
              <h2 className="mb-4 text-2xl font-extrabold text-yellow-400 md:text-3xl">
                {tituloSecao(marca)}
              </h2>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {itens.map((produto) => {
                  const tipo = tipoSelecionado[produto.id] || 'unidade';
                  const preco = tipo === 'caixa' ? produto.precoCaixa ?? 0 : produto.precoUnidade ?? 0;
                  const esgotado = !!produto.emFalta;
                  const imgSrc = imgSrcFrom(produto);

                  return (
                    <div
                      key={produto.id}
                      className={`flex flex-col p-4 transition-transform shadow-2xl rounded-xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 hover:scale-105 hover:shadow-yellow-400/20 ${
                        esgotado ? 'opacity-70' : ''
                      }`}
                    >
                      <div className="relative flex items-center justify-center w-full mb-3 overflow-hidden rounded-md aspect-square bg-black/20">
                        {esgotado && (
                          <span className="absolute z-10 px-2 py-1 text-xs font-bold text-white bg-red-600 rounded">
                            ESGOTADO
                          </span>
                        )}
                        <img src={imgSrc} alt={produto.nome} className="object-contain max-w-full max-h-full" />
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-yellow-400">{produto.nome}</h3>
                        <p className="mb-3 text-xs italic text-gray-400">{produto.descrição}</p>

                        {produto.disponivelPor && (
                          <select
                            value={tipoSelecionado[produto.id] || 'unidade'}
                            onChange={(e) =>
                              setTipoSelecionado((prev) => ({ ...prev, [produto.id]: e.target.value }))
                            }
                            disabled={esgotado}
                            className={`w-full p-2 mb-2 text-sm text-white rounded shadow-inner ${
                              esgotado
                                ? 'bg-zinc-800/60 cursor-not-allowed'
                                : 'bg-zinc-700 hover:bg-zinc-600'
                            }`}
                          >
                            {produto.disponivelPor.map((t) => (
                              <option key={t} value={t}>
                                {t === 'caixa' ? 'Por Caixa' : 'Por Unidade'}
                              </option>
                            ))}
                          </select>
                        )}

                        <p
                          className={`mb-2 text-lg font-semibold ${
                            esgotado ? 'text-gray-400' : 'text-green-400'
                          }`}
                        >
                          R$ {preco.toFixed(2)}
                        </p>

                        <div className="flex items-center justify-center gap-3 mb-3">
                          <button
                            className="w-8 h-8 text-lg text-black bg-yellow-400 rounded-full hover:bg-yellow-500 disabled:opacity-40"
                            onClick={() => alterarQuantidade(produto.id, -1)}
                            disabled={esgotado}
                          >
                            −
                          </button>
                          <span className="text-lg font-semibold">{quantidade[produto.id] || 0}</span>
                          <button
                            className="w-8 h-8 text-lg text-black bg-yellow-400 rounded-full hover:bg-yellow-500 disabled:opacity-40"
                            onClick={() => alterarQuantidade(produto.id, 1)}
                            disabled={esgotado}
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => handleAdicionar(produto)}
                          disabled={esgotado}
                          className={`w-full py-2 text-sm font-bold text-white uppercase transition-colors rounded ${
                            esgotado ? 'bg-zinc-700 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'
                          }`}
                        >
                          {esgotado ? 'Produto indisponível' : 'Adicionar ao Carrinho'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
