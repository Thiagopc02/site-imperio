'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { db } from '@/firebase/config';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

/* ----------------- Config de Admin ----------------- */
const ALLOWED_EMAILS = new Set<string>([
  'thiagotorres5517@gmail.com',
  'thiagotorresdeoliveira9@gmail.com',
]);

const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();

/* ----------------- Helpers seguros (sem any) ----------------- */
type UnknownRecord = Record<string, unknown>;

function getString(d: UnknownRecord, key: string): string {
  const v = d[key];
  return typeof v === 'string' ? v : '';
}

function getNumber(d: UnknownRecord, key: string): number | undefined {
  const v = d[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function getBoolean(d: UnknownRecord, key: string): boolean {
  const v = d[key];
  return v === true;
}

function getStringArray(d: UnknownRecord, key: string): string[] {
  const v = d[key];
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v as string[];
  return [];
}

/** tenta inferir marca pelo nome (fallback) */
function inferMarca(nome: string): string {
  const s = nome.trim();
  if (!s) return '';
  // você pode ir incrementando esse “dicionário” com o tempo
  const known: Array<[RegExp, string]> = [
    [/^coca[\s-]?cola/i, 'Coca-Cola'],
    [/^pepsi/i, 'Pepsi'],
    [/^guaran[aã]/i, 'Guaraná'],
    [/^brahma/i, 'Brahma'],
    [/^skol/i, 'Skol'],
    [/^heineken/i, 'Heineken'],
    [/^budweiser/i, 'Budweiser'],
    [/^antarctica/i, 'Antarctica'],
    [/^agua\s*crystal/i, 'Água Crystal'],
    [/^absolut/i, 'Absolut'],
    [/^red\s*bull/i, 'Red Bull'],
    [/^monster/i, 'Monster'],
  ];
  for (const [re, brand] of known) {
    if (re.test(s)) return brand;
  }
  // padrão: primeira “palavra”
  return s.split(/\s+/)[0] ?? '';
}

/** Normaliza o valor salvo em `imagem` para virar src válido */
function toImageSrc(raw?: string): string | null {
  if (!raw) return null;
  const s0 = raw.trim();
  if (!s0) return null;

  // URL completa
  if (/^https?:\/\//i.test(s0) || s0.startsWith('data:')) return s0;

  // remove prefixos comuns
  let s = s0.replace(/^\/+/, '');
  s = s.replace(/^public\//i, '');
  s = s.replace(/^produtos\//i, '');
  s = s.replace(/^\/?produtos\//i, '');

  // decodifica se veio com %C3%A3 etc
  try {
    s = decodeURIComponent(s);
  } catch {
    // se falhar, mantém como está
  }

  return `/produtos/${s}`;
}

/* Confere papel de admin no Firestore (sem any) */
async function hasAdminRole(uid: string): Promise<boolean> {
  const collectionsToCheck = ['administrador', 'admin', 'usuarios', 'usuários'];

  for (const col of collectionsToCheck) {
    try {
      const snap = await getDoc(doc(db, col, uid));
      if (!snap.exists()) continue;

      const d = snap.data() as UnknownRecord;
      const ativo = getBoolean(d, 'ativo');
      const papel = getString(d, 'papel');
      const role = getString(d, 'role');

      if (ativo) return true;
      if (papel === 'administrador') return true;
      if (role === 'admin') return true;
    } catch {
      // ignora e tenta a próxima collection
    }
  }
  return false;
}

/* ----------------- Tipos ----------------- */
type Produto = {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  marca: string;
  imagem: string;
  precoUnidade?: number;
  precoCaixa?: number;
  itensPorCaixa?: number;
  destaque: boolean;
  disponivelPor: Array<'unidade' | 'caixa'>;
  emFalta: boolean;
};

const CATEGORIAS = [
  'Refrescos e Sucos',
  'Fermentados',
  'Destilados',
  'Adega',
  'Águas',
  'Balas e Gomas',
  'Chocolates',
  'Tabacaria', // ✅ ADICIONADO AQUI
  'Copão de 770ml',
];

/* ----------------- Página ----------------- */
export default function AdminProdutosPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const unsubRef = useRef<Unsubscribe | null>(null);

  // filtros / organização
  const [busca, setBusca] = useState('');
  const [filtroMarca, setFiltroMarca] = useState(''); // vazio = todas
  const [filtroCategoria, setFiltroCategoria] = useState(''); // vazio = todas

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [marca, setMarca] = useState('');
  const [imagem, setImagem] = useState('');
  const [precoUnidade, setPrecoUnidade] = useState<string>('');
  const [precoCaixa, setPrecoCaixa] = useState<string>('');
  const [itensPorCaixa, setItensPorCaixa] = useState<string>('');
  const [destaque, setDestaque] = useState(false);
  const [dispUnidade, setDispUnidade] = useState(true);
  const [dispCaixa, setDispCaixa] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setNome('');
    setDescricao('');
    setCategoria('');
    setMarca('');
    setImagem('');
    setPrecoUnidade('');
    setPrecoCaixa('');
    setItensPorCaixa('');
    setDestaque(false);
    setDispUnidade(true);
    setDispCaixa(false);
  };

  // auth + gate
  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setErrMsg(null);
      setAuthReady(true);

      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      if (!u) {
        setIsAdmin(null);
        setProdutos([]);
        router.replace('/admin/login');
        return;
      }

      const mail = normalizeEmail(u.email || '');
      let admin = ALLOWED_EMAILS.has(mail);
      if (!admin) admin = await hasAdminRole(u.uid);
      setIsAdmin(admin);

      if (!admin) {
        setProdutos([]);
        return;
      }

      // snapshot produtos
      try {
        const qy = query(collection(db, 'produtos'), orderBy('nome', 'asc'));
        unsubRef.current = onSnapshot(
          qy,
          (snap) => {
            const list: Produto[] = [];

            snap.forEach((docSnap) => {
              const data = docSnap.data() as UnknownRecord;

              const nomeDoc = getString(data, 'nome');
              const categoriaDoc = getString(data, 'categoria');
              const imagemDoc = getString(data, 'imagem');

              const descricaoDoc =
                getString(data, 'descricao') || getString(data, 'descrição') || getString(data, 'descricão');

              const marcaDoc = getString(data, 'marca') || inferMarca(nomeDoc);

              const dispRaw = getStringArray(data, 'disponivelPor');
              const disponivelPor: Array<'unidade' | 'caixa'> = (dispRaw.includes('caixa')
                ? dispRaw.includes('unidade')
                  ? ['unidade', 'caixa']
                  : ['caixa']
                : ['unidade']) as Array<'unidade' | 'caixa'>;

              list.push({
                id: docSnap.id,
                nome: nomeDoc,
                descricao: descricaoDoc,
                categoria: categoriaDoc,
                marca: marcaDoc,
                imagem: imagemDoc,
                precoUnidade: getNumber(data, 'precoUnidade'),
                precoCaixa: getNumber(data, 'precoCaixa'),
                itensPorCaixa: getNumber(data, 'itensPorCaixa'),
                destaque: getBoolean(data, 'destaque'),
                disponivelPor,
                emFalta: getBoolean(data, 'emFalta'),
              });
            });

            setProdutos(list);
          },
          () => setErrMsg('Sem permissão para ler produtos. Revise regras do Firestore.')
        );
      } catch {
        setErrMsg('Falha ao carregar produtos.');
      }
    });

    return () => {
      unsub();
      if (unsubRef.current) unsubRef.current();
    };
  }, [router]);

  const marcasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const p of produtos) {
      const m = (p.marca || inferMarca(p.nome)).trim();
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return produtos.filter((p) => {
      const marcaFinal = (p.marca || inferMarca(p.nome)).trim();
      const okMarca = !filtroMarca || marcaFinal === filtroMarca;
      const okCat = !filtroCategoria || p.categoria === filtroCategoria;

      if (!okMarca || !okCat) return false;

      if (!q) return true;

      const hay = [p.nome, p.descricao, p.categoria, marcaFinal, p.imagem].join(' ').toLowerCase();

      return hay.includes(q);
    });
  }, [produtos, busca, filtroMarca, filtroCategoria]);

  const gruposPorMarca = useMemo(() => {
    const map = new Map<string, Produto[]>();

    for (const p of produtosFiltrados) {
      const mk = (p.marca || inferMarca(p.nome)).trim() || 'Sem marca';
      const arr = map.get(mk) ?? [];
      arr.push(p);
      map.set(mk, arr);
    }

    // ordena produtos dentro de cada marca
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      map.set(k, arr);
    }

    // retorna como array ordenado de marcas
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [produtosFiltrados]);

  const isValid = useMemo(() => {
    const disp: string[] = [];
    if (dispUnidade) disp.push('unidade');
    if (dispCaixa) disp.push('caixa');

    const precosOk = (!dispUnidade || Number(precoUnidade || 0) > 0) && (!dispCaixa || Number(precoCaixa || 0) > 0);

    return Boolean(nome.trim() && categoria && imagem.trim() && disp.length > 0 && precosOk);
  }, [nome, categoria, imagem, dispUnidade, dispCaixa, precoUnidade, precoCaixa]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isValid) {
      setErrMsg('Preencha os campos obrigatórios e os preços conforme a disponibilidade.');
      return;
    }
    setErrMsg(null);

    const disp: Array<'unidade' | 'caixa'> = [];
    if (dispUnidade) disp.push('unidade');
    if (dispCaixa) disp.push('caixa');

    const marcaFinal = (marca.trim() || inferMarca(nome)).trim();

    // Base payload (para create)
    const base = {
      nome: nome.trim(),
      categoria,
      imagem: imagem.trim(),
      destaque,
      disponivelPor: disp,
      emFalta: false,
      ...(marcaFinal ? { marca: marcaFinal } : {}),
      // salva NOS DOIS campos pra não quebrar nada que ainda use "descrição"
      descricao: descricao.trim(),
      ['descrição']: descricao.trim(),
    };

    const createPayload: Record<string, unknown> = { ...base };

    if (dispUnidade) {
      createPayload.precoUnidade = Number(Number(precoUnidade || 0).toFixed(2));
    }
    if (dispCaixa) {
      createPayload.precoCaixa = Number(Number(precoCaixa || 0).toFixed(2));
      const it = Number.parseInt(itensPorCaixa || '0', 10);
      if (it > 0) createPayload.itensPorCaixa = it;
    }

    // Update payload (permite deleteField)
    const updatePayload: Record<string, unknown> = { ...base };

    if (dispUnidade) {
      updatePayload.precoUnidade = Number(Number(precoUnidade || 0).toFixed(2));
    } else {
      updatePayload.precoUnidade = deleteField();
    }

    if (dispCaixa) {
      updatePayload.precoCaixa = Number(Number(precoCaixa || 0).toFixed(2));
      const it = Number.parseInt(itensPorCaixa || '0', 10);
      updatePayload.itensPorCaixa = it > 0 ? it : deleteField();
    } else {
      updatePayload.precoCaixa = deleteField();
      updatePayload.itensPorCaixa = deleteField();
    }

    if (!marcaFinal) {
      updatePayload.marca = deleteField();
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'produtos', editingId), updatePayload);
      } else {
        await addDoc(collection(db, 'produtos'), createPayload);
      }
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(err);
      setErrMsg(`Erro ao salvar: ${msg || 'verifique as regras do Firestore.'}`);
    }
  }

  function startEdit(p: Produto) {
    setEditingId(p.id || null);
    setNome(p.nome || '');
    setDescricao(p.descricao || '');
    setCategoria(p.categoria || '');
    setMarca(p.marca || inferMarca(p.nome) || '');
    setImagem(p.imagem || '');
    setPrecoUnidade(p.precoUnidade ? String(p.precoUnidade) : '');
    setPrecoCaixa(p.precoCaixa ? String(p.precoCaixa) : '');
    setItensPorCaixa(p.itensPorCaixa ? String(p.itensPorCaixa) : '');
    setDestaque(Boolean(p.destaque));
    setDispUnidade((p.disponivelPor || []).includes('unidade'));
    setDispCaixa((p.disponivelPor || []).includes('caixa'));
  }

  async function removeProduct(id?: string) {
    if (!id) return;
    const ok = window.confirm('Deseja excluir este produto?');
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'produtos', id));
      if (editingId === id) resetForm();
    } catch (err: unknown) {
      console.error(err);
      setErrMsg('Não foi possível excluir. Revise as permissões.');
    }
  }

  async function toggleFalta(p: Produto) {
    if (!p.id) return;
    try {
      await updateDoc(doc(db, 'produtos', p.id), { emFalta: !p.emFalta });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(err);
      setErrMsg(`Não foi possível atualizar estoque: ${msg}`);
    }
  }

  async function handleLogout() {
    await signOut(getAuth());
    router.replace('/admin/login');
  }

  if (!authReady) return <div className="p-6 text-white">Carregando…</div>;

  if (user === null) return <div className="p-6 text-white">Redirecionando…</div>;

  if (isAdmin === false) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 text-white bg-black">
        <div className="p-6 text-center bg-zinc-900 rounded-xl">
          <h1 className="mb-2 text-xl font-bold text-yellow-400">Acesso restrito</h1>
          <p className="text-gray-300">Sua conta não possui permissão de administrador.</p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 mt-4 text-sm font-semibold text-white bg-red-600 rounded hover:bg-red-700"
          >
            Sair e fazer login
          </button>
        </div>
      </div>
    );
  }

  const previewSrc = toImageSrc(imagem);
  const previewOk = Boolean(previewSrc);

  return (
    <div className="min-h-screen p-6 text-white bg-black">
      {/* Topbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-yellow-400">Gerenciar Produtos</h1>
        <span className="text-sm text-gray-400">Cadastro, edição e exclusão</span>

        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 ml-auto text-sm font-extrabold rounded-2xl focus:outline-none focus:ring-2"
          style={{
            background: 'linear-gradient(135deg, #60a5fa 0%, #22d3ee 50%, #34d399 100%)',
            boxShadow: '0 8px 24px rgba(96,165,250,.35), inset 0 0 12px rgba(255,255,255,.16)',
          }}
        >
          ← Voltar ao painel
        </Link>

        <div className="flex items-center gap-2">
          {user?.email && (
            <span className="px-2 py-1 text-xs text-gray-200 border rounded bg-zinc-800 border-zinc-700">
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded hover:bg-red-700"
            title="Sair"
          >
            Sair
          </button>
        </div>
      </div>

      {errMsg && (
        <div className="p-3 mb-4 text-sm text-red-200 border rounded bg-red-600/20 border-red-600/40">
          {errMsg}
        </div>
      )}

      {/* Formulário + Lista */}
      <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-3">
        {/* Form */}
        <form onSubmit={handleSubmit} className="col-span-1 p-6 shadow bg-zinc-900 rounded-xl">
          <h2 className="mb-4 text-lg font-semibold text-white">{editingId ? 'Editar produto' : 'Novo produto'}</h2>

          <label className="block mb-3">
            <span className="text-sm text-gray-300">Nome *</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-sm text-white border rounded outline-none bg-zinc-800 border-zinc-700"
              placeholder="Ex.: Coca Cola 2L"
              required
            />
          </label>

          <label className="block mb-3">
            <span className="text-sm text-gray-300">Marca (para organizar) *</span>
            <input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-sm text-white border rounded outline-none bg-zinc-800 border-zinc-700"
              placeholder="Ex.: Coca-Cola, Skol, Heineken..."
            />
            <p className="mt-1 text-[11px] text-gray-500">Se você deixar vazio, eu tento inferir pela primeira palavra do nome.</p>
          </label>

          <label className="block mb-3">
            <span className="text-sm text-gray-300">Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-sm text-white border rounded outline-none bg-zinc-800 border-zinc-700"
              rows={3}
              placeholder="Ex.: Refrigerante Coca-Cola garrafa PET 2 Litros"
            />
          </label>

          <label className="block mb-3">
            <span className="text-sm text-gray-300">Categoria *</span>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-sm text-white border rounded outline-none bg-zinc-800 border-zinc-700"
              required
            >
              <option value="">Selecione…</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-300">Disponível por</span>
              <div className="flex items-center gap-3 mt-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dispUnidade} onChange={(e) => setDispUnidade(e.target.checked)} />
                  Unidade
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dispCaixa} onChange={(e) => setDispCaixa(e.target.checked)} />
                  Caixa
                </label>
              </div>
            </label>

            <label className="block">
              <span className="text-sm text-gray-300">Destaque (Novidade)</span>
              <div className="mt-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} />
                  Exibir em “NOVIDADE”
                </label>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-3 md:grid-cols-3">
            <label className="block">
              <span className="text-sm text-gray-300">Preço (unidade)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={precoUnidade}
                onChange={(e) => setPrecoUnidade(e.target.value)}
                className="w-full px-3 py-2 mt-1 text-sm text-white border rounded outline-none bg-zinc-800 border-zinc-700"
                placeholder="0.00"
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-300">Preço (caixa)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={precoCaixa}
                onChange={(e) => setPrecoCaixa(e.target.value)}
                className="w-full px-3 py-2 mt-1 text-sm text-white border rounded outline-none bg-zinc-800 border-zinc-700"
                placeholder="0.00"
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-300">Itens por caixa</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={itensPorCaixa}
                onChange={(e) => setItensPorCaixa(e.target.value)}
                className="w-full px-3 py-2 mt-1 text-sm text-white border rounded outline-none bg-zinc-800 border-zinc-700"
                placeholder="Ex.: 6, 12, 24"
              />
            </label>
          </div>

          <label className="block mt-3">
            <span className="text-sm text-gray-300">Imagem (arquivo em /public/produtos) *</span>
            <input
              value={imagem}
              onChange={(e) => setImagem(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-sm text-white border rounded outline-none bg-zinc-800 border-zinc-700"
              placeholder="ex.: coca-cola-2l.jpg"
              required
            />

            {previewOk && (
              <div className="relative h-40 mt-2 overflow-hidden rounded bg-black/20">
                <Image
                  src={previewSrc as string}
                  alt="preview"
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-contain p-2"
                />
              </div>
            )}
          </label>

          <div className="flex items-center gap-3 mt-5">
            <button
              type="submit"
              disabled={!isValid}
              className={`px-4 py-2 text-sm font-semibold rounded ${
                isValid ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              {editingId ? 'Salvar alterações' : 'Adicionar produto'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-semibold text-white rounded bg-zinc-700 hover:bg-zinc-600"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        {/* Lista */}
        <div className="col-span-1 p-6 shadow lg:col-span-2 bg-zinc-900 rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-white">Produtos cadastrados</h2>

            {/* Buscador + filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="px-3 py-2 text-sm text-white border rounded bg-zinc-800 border-zinc-700"
                placeholder="Buscar por nome, marca, categoria…"
              />

              <select
                value={filtroMarca}
                onChange={(e) => setFiltroMarca(e.target.value)}
                className="px-3 py-2 text-sm text-white border rounded bg-zinc-800 border-zinc-700"
                title="Filtrar por marca"
              >
                <option value="">Todas as marcas</option>
                {marcasDisponiveis.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="px-3 py-2 text-sm text-white border rounded bg-zinc-800 border-zinc-700"
                title="Filtrar por categoria"
              >
                <option value="">Todas as categorias</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {(busca || filtroMarca || filtroCategoria) && (
                <button
                  onClick={() => {
                    setBusca('');
                    setFiltroMarca('');
                    setFiltroCategoria('');
                  }}
                  className="px-3 py-2 text-xs font-semibold text-white rounded bg-zinc-700 hover:bg-zinc-600"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {produtosFiltrados.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum produto encontrado.</p>
          ) : (
            <div className="space-y-6">
              {gruposPorMarca.map(([marcaKey, lista]) => (
                <div key={marcaKey}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-yellow-300">{marcaKey}</h3>
                    <span className="text-xs text-gray-400">{lista.length} item(s)</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {lista.map((p) => {
                      const src = toImageSrc(p.imagem);
                      const marcaFinal = (p.marca || inferMarca(p.nome)).trim();

                      return (
                        <div
                          key={p.id}
                          className={`p-3 rounded-lg shadow bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 ${
                            p.emFalta ? 'opacity-80' : ''
                          }`}
                        >
                          <div className="relative w-full mb-2 overflow-hidden rounded-md aspect-video bg-black/20">
                            {src ? (
                              <Image
                                src={src}
                                alt={p.nome}
                                fill
                                sizes="(max-width: 768px) 100vw, 400px"
                                className="object-contain p-2"
                              />
                            ) : (
                              <div className="flex items-center justify-center w-full h-full text-xs text-gray-500">
                                Sem imagem
                              </div>
                            )}
                          </div>

                          <h4 className="font-semibold text-yellow-400">{p.nome}</h4>

                          <p className="text-[11px] text-gray-400">
                            <span className="text-gray-300">Marca:</span> {marcaFinal || '—'}
                          </p>

                          <p className="text-xs text-gray-400">{p.descricao}</p>

                          <p className="mt-1 text-xs text-gray-300">
                            <strong>Categoria:</strong> {p.categoria || '—'}
                            {p.destaque && (
                              <span className="ml-2 px-2 py-0.5 text-[10px] rounded bg-pink-600/30 text-pink-300">
                                NOVIDADE
                              </span>
                            )}
                            {p.emFalta && (
                              <span className="ml-2 px-2 py-0.5 text-[10px] rounded bg-red-600/30 text-red-300">
                                EM FALTA
                              </span>
                            )}
                          </p>

                          <p className="mt-1 text-xs text-gray-300">
                            <strong>Disponível por:</strong> {(p.disponivelPor || []).join(', ') || '—'}
                          </p>

                          <p className="mt-1 text-xs text-gray-300">
                            <strong>Preço un.:</strong> {p.precoUnidade ? `R$ ${p.precoUnidade.toFixed(2)}` : '—'} &nbsp;|&nbsp;
                            <strong>Preço caixa:</strong> {p.precoCaixa ? `R$ ${p.precoCaixa.toFixed(2)}` : '—'} &nbsp;|&nbsp;
                            <strong>Itens/caixa:</strong> {p.itensPorCaixa || '—'}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <button
                              onClick={() => startEdit(p)}
                              className="px-3 py-1.5 text-xs font-semibold text-black bg-yellow-400 rounded hover:bg-yellow-500"
                            >
                              Editar
                            </button>

                            <button
                              onClick={() => removeProduct(p.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700"
                            >
                              Excluir
                            </button>

                            <button
                              onClick={() => toggleFalta(p)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded ${
                                p.emFalta
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-orange-500 text-black hover:bg-orange-600'
                              }`}
                              title={p.emFalta ? 'Marcar como disponível' : 'Marcar como em falta'}
                            >
                              {p.emFalta ? 'Marcar disponível' : 'Marcar em falta'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
