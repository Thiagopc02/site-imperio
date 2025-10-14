'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import { useCart } from '@/context/CartContext';
import {
  FaSearch,
  FaCocktail,
  FaBeer,
  FaGlassWhiskey,
  FaWineGlassAlt,
  FaTint,
  FaCandyCane,
  FaShoppingCart,
  FaTrashAlt,
  FaTimes,
} from 'react-icons/fa';
import { GiChocolateBar } from 'react-icons/gi';

type Produto = {
  id: string;
  nome: string;
  precoUnidade?: number;
  precoCaixa?: number;
  itensPorCaixa?: number;
  descrição: string;
  imagem: string;
  categoria: string;
  destaque: boolean;
  disponivelPor?: string[];
  emFalta?: boolean;
  marca?: string;
  ml?: number;
};

type CartItem = {
  id: string;
  nome: string;
  imagem: string;
  tipo: 'unidade' | 'caixa' | string;
  preco: number;
  quantidade: number;
};

const NOV_KEY = '__novidades__';
const COPAO_CAT = 'Copão de 770ml';

/* -------------------- Botões especiais -------------------- */
function NovidadeButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Novidades"
      className={[
        'relative inline-flex items-center justify-center',
        'px-4 py-2 rounded-xl text-sm font-extrabold text-white select-none',
        'transition ring-2 focus:outline-none',
        active ? 'ring-yellow-400' : 'ring-transparent',
      ].join(' ')}
      style={{
        width: 190,
        height: 52,
        background: 'linear-gradient(135deg, #ff48b0 0%, #8c6cff 45%, #42a5ff 100%)',
        boxShadow:
          '0 0 14px rgba(66,165,255,.55), 0 0 28px rgba(255,72,176,.35), inset 0 0 10px rgba(255,255,255,.12)',
      }}
    >
      <span
        className="px-3 py-1 text-black bg-white rounded-md drop-shadow"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,.15), 0 0 8px rgba(255,255,255,.45)' }}
      >
        NOVIDADE
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
        width: 210,
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
        <span style={{ transform: 'translateY(-1px)', WebkitTextStroke: '0.5px rgba(255,255,255,.22)' }}>
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

/* ---------------------- Utils ---------------------- */
function getMarca(p: Produto): string {
  if (p.marca && p.marca.trim()) return p.marca.trim();
  return inferirMarca(p.nome);
}
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
function getMl(p: Produto): number {
  if (typeof p.ml === 'number') return p.ml;
  return extrairVolumeMl(p.nome);
}
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
    if (v > 10) return Math.round(v);
    if (v > 0) return Math.round(v * 1000);
  }
  return 0;
}

type SortKey = 'mlDesc' | 'precoAsc' | 'precoDesc' | 'nomeAsc';

/* ==================== Página ==================== */
export default function ProdutosPage() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [quantidade, setQuantidade] = useState<Record<string, number>>({});
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('');
  const [marcasSelecionadas, setMarcasSelecionadas] = useState<string[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState('');
  const [apenasDisponiveis, setApenasDisponiveis] = useState(false);
  const [apenasNovidades, setApenasNovidades] = useState(false);
  const [apenasCopao, setApenasCopao] = useState(false);
  const [sort, setSort] = useState<SortKey>('mlDesc');

  // Popover de marcas
  const [openMarcas, setOpenMarcas] = useState(false);
  const [queryMarcas, setQueryMarcas] = useState('');
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // FAB + Drawer do carrinho
  const [showCartFab, setShowCartFab] = useState(false);
  const [openMiniCart, setOpenMiniCart] = useState(false);

  // CartContext
  const {
    adicionarAoCarrinho,
    items: cartItems,
    removerDoCarrinho,
    atualizarQuantidade,
    quantidadeTotal,
  }: {
    adicionarAoCarrinho: (p: any) => void;
    items?: CartItem[];
    removerDoCarrinho?: (id: string, tipo?: string) => void;
    atualizarQuantidade?: (id: string, tipo: string, qtd: number) => void;
    quantidadeTotal?: number;
  } = useCart() as any;

  // total (fallback caso o contexto não exponha quantidadeTotal)
  const cartCount =
    typeof quantidadeTotal === 'number'
      ? quantidadeTotal
      : ((cartItems ?? []) as CartItem[]).reduce((acc, it) => acc + (it.quantidade ?? 0), 0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
      else carregarProdutos();
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!openMarcas) return;
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenMarcas(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openMarcas]);

  // mostra/oculta o botão flutuante conforme rolagem
  useEffect(() => {
    const handler = () => setShowCartFab(window.scrollY > 140);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

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
        marca: typeof data.marca === 'string' ? data.marca : undefined,
        ml: typeof data.ml === 'number' ? data.ml : undefined,
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

  // categorias com ícones
  const categorias = [
    { nome: 'Refrescos e Sucos', Icon: FaCocktail },
    { nome: 'Fermentados', Icon: FaBeer },
    { nome: 'Destilados', Icon: FaGlassWhiskey },
    { nome: 'Adega', Icon: FaWineGlassAlt },
    { nome: 'Águas', Icon: FaTint },
    { nome: 'Balas e Gomas', Icon: FaCandyCane },
    { nome: 'Chocolates', Icon: GiChocolateBar },
  ] as const;

  const baseFiltrada = useMemo(() => {
    let base = produtos.slice();

    if (apenasNovidades || categoriaSelecionada === NOV_KEY) {
      base = base.filter((p) => p.destaque);
    } else if (apenasCopao || categoriaSelecionada === COPAO_CAT) {
      base = base.filter((p) => p.categoria === COPAO_CAT);
    } else if (categoriaSelecionada) {
      base = base.filter((p) => p.categoria === categoriaSelecionada);
    }

    if (apenasDisponiveis) base = base.filter((p) => !p.emFalta);

    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      base = base.filter((p) => {
        const marca = getMarca(p).toLowerCase();
        return (
          p.nome.toLowerCase().includes(q) ||
          marca.includes(q) ||
          (p.descrição || '').toLowerCase().includes(q)
        );
      });
    }

    if (marcasSelecionadas.length) {
      const set = new Set(marcasSelecionadas);
      base = base.filter((p) => set.has(getMarca(p)));
    }

    switch (sort) {
      case 'mlDesc':
        base.sort((a, b) => getMl(b) - getMl(a));
        break;
      case 'precoAsc':
        base.sort((a, b) => (a.precoUnidade ?? 0) - (b.precoUnidade ?? 0));
        break;
      case 'precoDesc':
        base.sort((a, b) => (b.precoUnidade ?? 0) - (a.precoUnidade ?? 0));
        break;
      case 'nomeAsc':
        base.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
    }

    return base;
  }, [
    produtos,
    categoriaSelecionada,
    apenasNovidades,
    apenasCopao,
    apenasDisponiveis,
    marcasSelecionadas,
    busca,
    sort,
  ]);

  const marcasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    baseFiltrada.forEach((p) => set.add(getMarca(p)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [baseFiltrada]);

  const gruposPorMarca = useMemo(() => {
    const mapa = new Map<string, Produto[]>();
    for (const p of baseFiltrada) {
      const marca = getMarca(p);
      if (!mapa.has(marca)) mapa.set(marca, []);
      mapa.get(marca)!.push(p);
    }
    for (const arr of mapa.values()) {
      arr.sort((a, b) => {
        const vb = getMl(b);
        const va = getMl(a);
        if (vb !== va) return vb - va;
        return a.nome.localeCompare(b.nome);
      });
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [baseFiltrada]);

  const limparFiltros = () => {
    setCategoriaSelecionada('');
    setMarcasSelecionadas([]);
    setBusca('');
    setApenasDisponiveis(false);
    setApenasNovidades(false);
    setApenasCopao(false);
    setSort('mlDesc');
  };

  const imgSrcFrom = (produto: Produto) =>
    produto.imagem?.startsWith('http') || produto.imagem?.startsWith('/')
      ? produto.imagem
      : `/produtos/${produto.imagem}`;

  function tituloSecao(marca: string) {
    const prefix =
      categoriaSelecionada === 'Refrescos e Sucos'
        ? 'Refrigerantes'
        : categoriaSelecionada && categoriaSelecionada !== NOV_KEY && categoriaSelecionada !== COPAO_CAT
        ? categoriaSelecionada
        : 'Produtos';
    return `${prefix} ${marca}`.trim();
  }

  const marcasFiltradasPopover = useMemo(() => {
    const q = queryMarcas.trim().toLowerCase();
    if (!q) return marcasDisponiveis;
    return marcasDisponiveis.filter((m) => m.toLowerCase().includes(q));
  }, [marcasDisponiveis, queryMarcas]);

  const badgesSelecionadas = useMemo(() => {
    const max = 4;
    const head = marcasSelecionadas.slice(0, max);
    const rest = marcasSelecionadas.length - head.length;
    return { head, rest };
  }, [marcasSelecionadas]);

  /* --- UI auxiliares --- */
  const CategoriaPill = ({
    active,
    onClick,
    children,
  }: {
    active?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={[
        'group relative overflow-hidden',
        'px-4 py-2 rounded-2xl text-sm font-semibold',
        'bg-zinc-900/80 border border-white/10',
        'hover:border-white/30 hover:bg-zinc-900',
        active ? 'ring-2 ring-yellow-400' : '',
        'transition',
      ].join(' ')}
    >
      <span className="relative z-10 flex items-center gap-2 text-white">{children}</span>
      <span
        aria-hidden
        className="absolute inset-0 transition opacity-0 bg-gradient-to-r from-white/5 to-white/0 group-hover:opacity-100"
      />
    </button>
  );

  const MarcasTrigger = () => (
    <button
      onClick={() => setOpenMarcas((v) => !v)}
      className="px-4 py-2 rounded-2xl text-sm font-bold tracking-wide bg-zinc-900/80 border border-transparent hover:border-yellow-300/50 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
      style={{
        backgroundImage:
          'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0)), radial-gradient(100% 100% at 0% 0%, rgba(253,224,71,0.35), rgba(153,27,27,0) 60%)',
      }}
      aria-expanded={openMarcas}
    >
      MARCAS {marcasSelecionadas.length ? `(${marcasSelecionadas.length})` : ''}
    </button>
  );

  /* ------------------ Render ------------------ */
  return (
    <main className="min-h-screen px-4 py-8 text-white bg-black">
      <div className="mx-auto max-w-7xl">
        <p className="mb-2 text-sm text-center text-zinc-300">
          Produtos organizados por <b>marca</b> — do <b>MAIOR</b> para o <b>MENOR</b> volume (ml).
        </p>

        <h1 className="text-4xl sm:text-5xl md:text-6xl text-center font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 via-orange-600 to-red-600 mb-6 drop-shadow-[2px_2px_2px_#ff0000]">
          CATEGORIAS
        </h1>

        {/* Categorias + especiais */}
        <div className="flex flex-wrap justify-center gap-3 mb-5">
          {categorias.map(({ nome, Icon }) => (
            <CategoriaPill
              key={nome}
              active={categoriaSelecionada === nome}
              onClick={() => setCategoriaSelecionada(nome)}
            >
              <Icon className="opacity-90" />
              {nome}
            </CategoriaPill>
          ))}
          <CopaoButton
            active={apenasCopao || categoriaSelecionada === COPAO_CAT}
            onClick={() => {
              setCategoriaSelecionada(COPAO_CAT);
              setApenasCopao(true);
              setApenasNovidades(false);
            }}
          />
          <NovidadeButton
            active={apenasNovidades || categoriaSelecionada === NOV_KEY}
            onClick={() => {
              setCategoriaSelecionada(NOV_KEY);
              setApenasNovidades(true);
              setApenasCopao(false);
            }}
          />
        </div>

        {/* Busca + filtros + ordenação */}
        <div className="grid grid-cols-1 gap-3 mb-3 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="relative">
              <FaSearch className="absolute -translate-y-1/2 left-3 top-1/2 opacity-70" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou marca…"
                className="w-full py-3 pl-10 pr-4 outline-none rounded-xl bg-white/10 focus:bg-white/15"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:col-span-4">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10">
              <input
                type="checkbox"
                className="accent-yellow-400"
                checked={apenasDisponiveis}
                onChange={(e) => setApenasDisponiveis(e.target.checked)}
              />
              <span className="text-sm">Somente disponíveis</span>
            </label>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10">
              <input
                type="checkbox"
                className="accent-yellow-400"
                checked={apenasNovidades}
                onChange={(e) => {
                  setApenasNovidades(e.target.checked);
                  if (e.target.checked) setApenasCopao(false);
                }}
              />
              <span className="text-sm">Novidades</span>
            </label>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10">
              <input
                type="checkbox"
                className="accent-yellow-400"
                checked={apenasCopao}
                onChange={(e) => {
                  setApenasCopao(e.target.checked);
                  if (e.target.checked) setApenasNovidades(false);
                }}
              />
              <span className="text-sm">Copão 770ml</span>
            </label>
          </div>

          <div className="lg:col-span-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full px-4 py-3 text-white bg-black border outline-none rounded-xl border-white/20"
            >
              <option value="mlDesc">Ordenar: maior volume (ml) ↓</option>
              <option value="precoAsc">Preço: menor → maior</option>
              <option value="precoDesc">Preço: maior → menor</option>
              <option value="nomeAsc">Nome: A → Z</option>
            </select>
          </div>
        </div>

        {/* Controle de Marcas (especial) */}
        <div className="relative mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <MarcasTrigger />

            {/* Hint: "O que você procura?" com seta vermelha */}
            <div className="relative inline-flex items-center ml-3 animate-pulse">
              <span className="absolute w-3 h-3 rotate-45 -translate-y-1/2 bg-red-500 border border-red-700 shadow -left-2 top-1/2" />
              <span className="px-3 py-1 text-xs font-bold text-white bg-red-600 rounded-full shadow-lg">
                O que você procura?
              </span>
            </div>

            {/* badges selecionadas */}
            {badgesSelecionadas.head.map((m) => (
              <span
                key={m}
                className="px-2 py-1 text-xs font-semibold text-black border rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 border-yellow-500/50"
              >
                {m}
                <button
                  onClick={() => setMarcasSelecionadas((prev) => prev.filter((x) => x !== m))}
                  className="ml-1 text-black/70 hover:text-black"
                  aria-label={`Remover ${m}`}
                >
                  ×
                </button>
              </span>
            ))}
            {badgesSelecionadas.rest > 0 && (
              <span className="text-xs opacity-70">+{badgesSelecionadas.rest}</span>
            )}

            {(marcasSelecionadas.length ||
              categoriaSelecionada ||
              busca ||
              apenasDisponiveis ||
              apenasNovidades ||
              apenasCopao ||
              sort !== 'mlDesc') && (
              <button
                onClick={limparFiltros}
                className="px-3 py-2 ml-auto text-sm border rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border-white/10"
                title="Limpar filtros"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Popover de marcas */}
          {openMarcas && (
            <div
              ref={popoverRef}
              className="absolute z-20 mt-2 w-full sm:w-[520px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
            >
              <div className="p-3 border-b border-white/10">
                <div className="relative">
                  <FaSearch className="absolute -translate-y-1/2 left-3 top-1/2 opacity-70" />
                  <input
                    value={queryMarcas}
                    onChange={(e) => setQueryMarcas(e.target.value)}
                    placeholder="Buscar marca…"
                    className="w-full py-2 pl-10 pr-3 rounded-lg outline-none bg-black/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 p-2 overflow-auto max-h-72">
                {marcasFiltradasPopover.map((m) => {
                  const checked = marcasSelecionadas.includes(m);
                  return (
                    <label
                      key={m}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md border cursor-pointer ${
                        checked
                          ? 'bg-yellow-400/15 border-yellow-400/40'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-yellow-400"
                        checked={checked}
                        onChange={(e) =>
                          setMarcasSelecionadas((prev) =>
                            e.target.checked ? [...prev, m] : prev.filter((x) => x !== m)
                          )
                        }
                      />
                      <span className="text-sm">{m}</span>
                    </label>
                  );
                })}
                {marcasFiltradasPopover.length === 0 && (
                  <div className="col-span-2 py-6 text-sm text-center opacity-60">
                    Nenhuma marca encontrada.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 p-3 border-t border-white/10">
                <button
                  onClick={() => setMarcasSelecionadas([])}
                  className="px-3 py-2 text-sm border rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border-white/10"
                >
                  Limpar
                </button>
                <button
                  onClick={() => setOpenMarcas(false)}
                  className="px-3 py-2 text-sm font-semibold text-black bg-yellow-500 rounded-lg hover:bg-yellow-400"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Listagem agrupada */}
        {gruposPorMarca.length === 0 ? (
          <p className="font-semibold text-center text-red-400">
            Nenhum produto encontrado com os filtros atuais.
          </p>
        ) : (
          gruposPorMarca.map(([marca, itens]) => (
            <section key={marca} className="mb-10">
              <h2 className="mb-4 text-2xl font-extrabold text-yellow-400 md:text-3xl">
                {tituloSecao(marca)}
              </h2>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {itens.map((produto) => {
                  const tipo = tipoSelecionado[produto.id] || 'unidade';
                  const preco =
                    tipo === 'caixa' ? produto.precoCaixa ?? 0 : produto.precoUnidade ?? 0;
                  const esgotado = !!produto.emFalta;
                  const imgSrc = imgSrcFrom(produto);

                  return (
                    <div
                      key={produto.id}
                      className={`flex flex-col p-4 transition-transform shadow-2xl rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 hover:scale-[1.02] hover:shadow-yellow-400/20 ${
                        esgotado ? 'opacity-70' : ''
                      }`}
                    >
                      <div className="relative flex items-center justify-center w-full mb-3 overflow-hidden rounded-xl aspect-square bg-black/20">
                        {esgotado && (
                          <span className="absolute z-10 px-2 py-1 text-xs font-bold text-white bg-red-600 rounded">
                            ESGOTADO
                          </span>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgSrc}
                          alt={produto.nome}
                          className="object-contain max-w-full max-h-full"
                          loading="lazy"
                        />
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
                          <span className="text-lg font-semibold">
                            {quantidade[produto.id] || 0}
                          </span>
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

      {/* Botão flutuante do carrinho com badge de itens */}
      {showCartFab && (
        <button
          onClick={() => setOpenMiniCart(true)}
          title="Abrir carrinho"
          aria-label="Abrir carrinho"
          className={[
            'fixed right-4 md:right-6 top-1/2 -translate-y-1/2 z-30',
            'rounded-full p-4 md:p-5',
            'bg-black text-white',
            'transition transform hover:scale-105 active:scale-95',
            'shadow-[0_0_22px_rgba(34,197,94,0.75),0_0_48px_rgba(34,197,94,0.55)]',
            'hover:shadow-[0_0_34px_rgba(34,197,94,0.95),0_0_68px_rgba(34,197,94,0.75)]',
            'border border-green-400/60 hover:border-green-300',
            'ring-1 ring-green-500/30',
            'relative',
          ].join(' ')}
          style={{
            boxShadow:
              '0 0 22px rgba(34,197,94,.75), 0 0 48px rgba(34,197,94,.55), inset 0 0 14px rgba(34,197,94,.22)',
          }}
        >
          <FaShoppingCart className="w-7 h-7 md:w-9 md:h-9" />
          {/* badge */}
          {cartCount > 0 && (
            <span
              className={[
                'absolute -top-2 -right-2 min-w-[22px] h-[22px]',
                'rounded-full text-[12px] font-bold',
                'bg-green-500 text-black flex items-center justify-center',
                'shadow-[0_0_12px_rgba(34,197,94,0.9)] ring-1 ring-green-900/30',
              ].join(' ')}
              aria-label={`${cartCount} itens no carrinho`}
            >
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </button>
      )}

      {/* Overlay + Drawer Mini-Carrinho */}
      {openMiniCart && (
        <>
          {/* overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpenMiniCart(false)}
          />
          {/* drawer */}
          <aside
            className="fixed right-0 top-0 z-50 h-full w-[92%] sm:w-[420px] bg-zinc-950 border-l border-white/10 shadow-2xl flex flex-col"
            role="dialog"
            aria-label="Mini carrinho"
          >
            {/* header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FaShoppingCart />
                <h3 className="text-lg font-bold">Seu carrinho</h3>
              </div>
              <button
                onClick={() => setOpenMiniCart(false)}
                className="p-2 rounded-md bg-white/5 hover:bg-white/10"
                aria-label="Fechar mini carrinho"
              >
                <FaTimes />
              </button>
            </div>

            {/* items */}
            <div className="flex-1 overflow-auto divide-y divide-white/5">
              {(cartItems ?? []).length === 0 ? (
                <div className="flex items-center justify-center h-full px-6 text-sm text-center opacity-70">
                  Seu carrinho está vazio. Adicione produtos para visualizar aqui.
                </div>
              ) : (
                (cartItems as CartItem[]).map((item) => {
                  const totalItem = (item.preco ?? 0) * (item.quantidade ?? 0);
                  const canUpdate = typeof atualizarQuantidade === 'function';
                  const canRemove = typeof removerDoCarrinho === 'function';

                  return (
                    <div key={`${item.id}-${item.tipo}`} className="flex gap-3 p-3">
                      <div className="flex items-center justify-center w-16 h-16 overflow-hidden rounded-lg bg:white/5 bg-white/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            item.imagem?.startsWith('http') || item.imagem?.startsWith('/')
                              ? item.imagem
                              : `/produtos/${item.imagem}`
                          }
                          alt={item.nome}
                          className="object-contain max-w-full max-h-full"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.nome}</p>
                        <p className="text-xs opacity-70">Tipo: {item.tipo || 'unidade'}</p>
                        <p className="mt-1 text-sm text-green-400">
                          R$ {(item.preco ?? 0).toFixed(2)}{' '}
                          <span className="text-xs opacity-60">/ {item.tipo || 'unidade'}</span>
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <button
                            className="font-bold text-black bg-yellow-400 rounded-full w-7 h-7 disabled:opacity-40"
                            onClick={() =>
                              atualizarQuantidade?.(item.id, item.tipo, Math.max((item.quantidade ?? 1) - 1, 0))
                            }
                            disabled={!canUpdate}
                          >
                            −
                          </button>
                          <span className="min-w-[1.5rem] text-center text-sm font-semibold">
                            {item.quantidade ?? 0}
                          </span>
                          <button
                            className="font-bold text-black bg-yellow-400 rounded-full w-7 h-7 disabled:opacity-40"
                            onClick={() => atualizarQuantidade?.(item.id, item.tipo, (item.quantidade ?? 0) + 1)}
                            disabled={!canUpdate}
                          >
                            +
                          </button>

                          <button
                            className="px-2 py-1 ml-auto text-xs text-white rounded-md bg-red-600/80 hover:bg-red-600 disabled:opacity-40"
                            onClick={() => removerDoCarrinho?.(item.id, item.tipo)}
                            disabled={!canRemove}
                          >
                            <span className="inline-flex items-center gap-1">
                              <FaTrashAlt /> Remover
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-right whitespace-nowrap">
                        R$ {totalItem.toFixed(2)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* footer */}
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm opacity-80">Subtotal</span>
                <strong className="text-lg text-green-400">
                  R${' '}
                  {((cartItems ?? []) as CartItem[])
                    .reduce((acc, it) => acc + (it.preco ?? 0) * (it.quantidade ?? 0), 0)
                    .toFixed(2)}
                </strong>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setOpenMiniCart(false)}
                  className="flex-1 py-2 border rounded-lg border-white/15 bg-white/5 hover:bg-white/10"
                >
                  Continuar comprando
                </button>
                <button
                  onClick={() => router.push('/carrinho')}
                  className="flex-1 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold shadow-[0_0_18px_rgba(234,179,8,0.35)] disabled:opacity-40"
                  disabled={cartCount === 0}
                >
                  Finalizar compra
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
