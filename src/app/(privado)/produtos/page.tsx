'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */

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
import { GiChocolateBar, GiSmokingPipe } from 'react-icons/gi';

/* ======================= Tipos ======================= */
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
  tipo: string;
  preco: number;
  quantidade: number;
};

type AddToCartPayload = Produto & {
  tipo: string;
  preco: number;
  quantidade: number;
};

type SortKey = 'mlDesc' | 'precoAsc' | 'precoDesc' | 'nomeAsc';

const NOV_KEY = '__novidades__';
const COPAO_CAT = 'Copão de 770ml';

/* ======================= Utils ======================= */
function getMarca(p: Produto): string {
  if (p.marca && p.marca.trim()) return p.marca.trim();
  const primeira = p.nome.split(' ')[0];
  return primeira.charAt(0).toUpperCase() + primeira.slice(1);
}

function getMl(p: Produto): number {
  if (typeof p.ml === 'number') return p.ml;
  const m = p.nome.toLowerCase().match(/(\d+)\s?ml/);
  return m ? parseInt(m[1], 10) : 0;
}

/* ======================= Página ======================= */
export default function ProdutosPage() {
  const router = useRouter();

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [quantidade, setQuantidade] = useState<Record<string, number>>({});
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [marcasSelecionadas, setMarcasSelecionadas] = useState<string[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState('');
  const [apenasDisponiveis, setApenasDisponiveis] = useState(false);
  const [apenasNovidades, setApenasNovidades] = useState(false);
  const [apenasCopao, setApenasCopao] = useState(false);
  const [sort, setSort] = useState<SortKey>('mlDesc');

  const [openMiniCart, setOpenMiniCart] = useState(false);
  const [showFab, setShowFab] = useState(false);

  const {
    adicionarAoCarrinho,
    items: cartItems,
    removerDoCarrinho,
    atualizarQuantidade,
    quantidadeTotal,
  } = useCart() as {
    adicionarAoCarrinho: (p: AddToCartPayload) => void;
    items: CartItem[];
    removerDoCarrinho: (id: string, tipo?: string) => void;
    atualizarQuantidade: (id: string, tipo: string, qtd: number) => void;
    quantidadeTotal: number;
  };

  const cartCount = quantidadeTotal ?? 0;

  /* ======================= Auth ======================= */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
      else carregarProdutos();
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    const onScroll = () => setShowFab(window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ======================= Loader ======================= */
  async function carregarProdutos() {
    const snap = await getDocs(collection(db, 'produtos'));
    const lista: Produto[] = [];
    snap.forEach((d) => {
      const data = d.data();
      lista.push({
        id: d.id,
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
        marca: data.marca,
        ml: data.ml,
      });
    });
    setProdutos(lista);
  }

  /* ======================= Helpers ======================= */
  function alterarQuantidade(id: string, delta: number) {
    setQuantidade((prev) => ({
      ...prev,
      [id]: Math.max((prev[id] || 0) + delta, 0),
    }));
  }

  function handleAdicionar(produto: Produto) {
    const tipo = tipoSelecionado[produto.id] || 'unidade';
    const preco = tipo === 'caixa' ? produto.precoCaixa ?? 0 : produto.precoUnidade ?? 0;

    adicionarAoCarrinho({
      ...produto,
      tipo,
      preco,
      quantidade: quantidade[produto.id] || 1,
    });

    setQuantidade((p) => ({ ...p, [produto.id]: 0 }));
  }

  /* ======================= Filtros ======================= */
  const produtosFiltrados = useMemo(() => {
    let base = [...produtos];

    if (categoriaSelecionada)
      base = base.filter((p) => p.categoria === categoriaSelecionada);

    if (apenasNovidades) base = base.filter((p) => p.destaque);
    if (apenasCopao) base = base.filter((p) => p.categoria === COPAO_CAT);
    if (apenasDisponiveis) base = base.filter((p) => !p.emFalta);

    if (busca)
      base = base.filter(
        (p) =>
          p.nome.toLowerCase().includes(busca.toLowerCase()) ||
          getMarca(p).toLowerCase().includes(busca.toLowerCase())
      );

    if (marcasSelecionadas.length)
      base = base.filter((p) => marcasSelecionadas.includes(getMarca(p)));

    if (sort === 'mlDesc') base.sort((a, b) => getMl(b) - getMl(a));
    if (sort === 'precoAsc')
      base.sort((a, b) => (a.precoUnidade ?? 0) - (b.precoUnidade ?? 0));
    if (sort === 'precoDesc')
      base.sort((a, b) => (b.precoUnidade ?? 0) - (a.precoUnidade ?? 0));
    if (sort === 'nomeAsc') base.sort((a, b) => a.nome.localeCompare(b.nome));

    return base;
  }, [
    produtos,
    categoriaSelecionada,
    apenasNovidades,
    apenasCopao,
    apenasDisponiveis,
    busca,
    marcasSelecionadas,
    sort,
  ]);

  /* ======================= Render ======================= */
  return (
    <main className="min-h-screen px-4 py-8 text-white bg-black">
      <h1 className="mb-6 text-4xl font-extrabold text-center text-yellow-500">
        Produtos
      </h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {produtosFiltrados.map((produto) => (
          <div
            key={produto.id}
            className="p-4 bg-zinc-900 rounded-xl shadow hover:scale-[1.02] transition"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                produto.imagem.startsWith('http')
                  ? produto.imagem
                  : `/produtos/${produto.imagem}`
              }
              alt={produto.nome}
              className="object-contain w-full h-40 mb-3"
            />

            <h3 className="text-lg font-bold text-yellow-400">{produto.nome}</h3>
            <p className="mb-2 text-sm text-gray-400">{produto.descrição}</p>

            <p className="mb-2 text-green-400">
              R$ {(produto.precoUnidade ?? 0).toFixed(2)}
            </p>

            <div className="flex items-center justify-center gap-3 mb-3">
              <button
                onClick={() => alterarQuantidade(produto.id, -1)}
                className="w-8 h-8 text-black bg-yellow-400 rounded-full"
              >
                −
              </button>
              <span>{quantidade[produto.id] || 0}</span>
              <button
                onClick={() => alterarQuantidade(produto.id, 1)}
                className="w-8 h-8 text-black bg-yellow-400 rounded-full"
              >
                +
              </button>
            </div>

            <button
              onClick={() => handleAdicionar(produto)}
              className="w-full py-2 font-bold text-black bg-yellow-500 rounded"
            >
              Adicionar ao carrinho
            </button>
          </div>
        ))}
      </div>

      {/* FAB */}
      {showFab && (
        <button
          onClick={() => setOpenMiniCart(true)}
          className="fixed p-4 text-white bg-green-500 rounded-full shadow bottom-6 right-6"
        >
          <FaShoppingCart />
          {cartCount > 0 && (
            <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-black bg-yellow-400 rounded-full">
              {cartCount}
            </span>
          )}
        </button>
      )}
    </main>
  );
}
