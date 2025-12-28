'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { db } from '@/firebase/config';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  deleteField,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

/* ----------------- Config de Admin ----------------- */
const ALLOWED_EMAILS = new Set<string>([
  'thiagotorres5517@gmail.com',
  'thiagotorresdeoliveira9@gmail.com',
]);

const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();

type AdminDoc = { ativo?: boolean; papel?: string; role?: string };
const isAdminDoc = (x: unknown): x is AdminDoc => typeof x === 'object' && x !== null;

async function hasAdminRole(uid: string): Promise<boolean> {
  const tryCol = async (col: string) => {
    try {
      const s = await getDoc(doc(db, col, uid));
      if (!s.exists()) return false;
      const d = s.data() as unknown;
      if (!isAdminDoc(d)) return false;
      return d.ativo === true || d.papel === 'administrador' || d.role === 'admin';
    } catch {
      return false;
    }
  };

  if (await tryCol('administrador')) return true;
  if (await tryCol('admin')) return true;
  if (await tryCol('usuarios')) return true;
  if (await tryCol('usuários')) return true;
  return false;
}

/* ----------------- Tipos ----------------- */
type DisponivelPor = 'unidade' | 'caixa';

type Produto = {
  id?: string;
  nome: string;
  descricao: string;
  categoria: string;
  imagem: string; // nome do arquivo em /public/produtos/
  precoUnidade?: number;
  precoCaixa?: number;
  itensPorCaixa?: number;
  destaque: boolean;
  disponivelPor: DisponivelPor[];
  emFalta?: boolean;
};

const CATEGORIAS = [
  'Refrescos e Sucos',
  'Fermentados',
  'Destilados',
  'Adega',
  'Águas',
  'Balas e Gomas',
  'Chocolates',
  'Copão de 770ml',
] as const;

/* ----------------- Página ----------------- */
export default function AdminProdutosPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const unsubRef = useRef<Unsubscribe | null>(null);

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
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
    setImagem('');
    setPrecoUnidade('');
    setPrecoCaixa('');
    setItensPorCaixa('');
    setDestaque(false);
    setDispUnidade(true);
    setDispCaixa(false);
  };

  // auth + gate + snapshot
  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setErrMsg(null);

      // sempre encerra snapshot anterior
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

      try {
        const qy = query(collection(db, 'produtos'), orderBy('nome', 'asc'));
        unsubRef.current = onSnapshot(
          qy,
          (snap) => {
            const list: Produto[] = [];
            snap.forEach((docSnap) => {
              const data = docSnap.data() as DocumentData;

              const rawDisp = data.disponivelPor;
              const disp: DisponivelPor[] = Array.isArray(rawDisp)
                ? (rawDisp.filter((x: unknown) => x === 'unidade' || x === 'caixa') as DisponivelPor[])
                : ['unidade'];

              // compat: Firestore pode ter "descricao" ou "descrição"
              const desc =
                (typeof data.descricao === 'string' ? data.descricao : '') ||
                (typeof data['descrição'] === 'string' ? (data['descrição'] as string) : '');

              list.push({
                id: docSnap.id,
                nome: typeof data.nome === 'string' ? data.nome : '',
                descricao: desc,
                categoria: typeof data.categoria === 'string' ? data.categoria : '',
                imagem: typeof data.imagem === 'string' ? data.imagem : '',
                precoUnidade: typeof data.precoUnidade === 'number' ? data.precoUnidade : undefined,
                precoCaixa: typeof data.precoCaixa === 'number' ? data.precoCaixa : undefined,
                itensPorCaixa: typeof data.itensPorCaixa === 'number' ? data.itensPorCaixa : undefined,
                destaque: Boolean(data.destaque),
                disponivelPor: disp.length ? disp : ['unidade'],
                emFalta: Boolean(data.emFalta),
              });
            });

            setProdutos(list);
          },
          (e) => setErrMsg(`Erro ao ler produtos: ${e.message}`),
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

  const isValid = useMemo(() => {
    const disp: DisponivelPor[] = [];
    if (dispUnidade) disp.push('unidade');
    if (dispCaixa) disp.push('caixa');

    const pu = Number(precoUnidade || '0');
    const pc = Number(precoCaixa || '0');

    const precosOk = (!dispUnidade || pu > 0) && (!dispCaixa || pc > 0);

    return Boolean(nome.trim() && categoria && imagem.trim() && disp.length > 0 && precosOk);
  }, [nome, categoria, imagem, dispUnidade, dispCaixa, precoUnidade, precoCaixa]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isValid) {
      setErrMsg('Preencha os campos obrigatórios e os preços conforme a disponibilidade.');
      return;
    }
    setErrMsg(null);

    const disp: DisponivelPor[] = [];
    if (dispUnidade) disp.push('unidade');
    if (dispCaixa) disp.push('caixa');

    const descTrim = descricao.trim();

    // payload base
    const basePayload: Record<string, unknown> = {
      nome: nome.trim(),
      categoria,
      imagem: imagem.trim(),
      destaque,
      disponivelPor: disp,
      emFalta: false,
      // grava nos 2 formatos pra compatibilidade (pode remover o de acento depois, se quiser)
      descricao: descTrim,
      'descrição': descTrim,
    };

    const pu = Number(parseFloat(precoUnidade || '0').toFixed(2));
    const pc = Number(parseFloat(precoCaixa || '0').toFixed(2));
    const it = Number.parseInt(itensPorCaixa || '0');

    try {
      if (editingId) {
        // UPDATE: aqui pode usar deleteField()
        const updatePayload: Record<string, unknown> = { ...basePayload };

        if (dispUnidade) updatePayload.precoUnidade = pu;
        else updatePayload.precoUnidade = deleteField();

        if (dispCaixa) {
          updatePayload.precoCaixa = pc;
          updatePayload.itensPorCaixa = it > 0 ? it : deleteField();
        } else {
          updatePayload.precoCaixa = deleteField();
          updatePayload.itensPorCaixa = deleteField();
        }

        await updateDoc(doc(db, 'produtos', editingId), updatePayload);
      } else {
        // CREATE: NÃO envia deleteField() no addDoc
        const createPayload: Record<string, unknown> = { ...basePayload };

        if (dispUnidade) createPayload.precoUnidade = pu;
        if (dispCaixa) {
          createPayload.precoCaixa = pc;
          if (it > 0) createPayload.itensPorCaixa = it;
        }

        await addDoc(collection(db, 'produtos'), createPayload);
      }

      resetForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'verifique as regras do Firestore.';
      console.error(err);
      setErrMsg(`Erro ao salvar: ${msg}`);
    }
  }

  function startEdit(p: Produto) {
    setEditingId(p.id || null);
    setNome(p.nome || '');
    setDescricao(p.descricao || '');
    setCategoria(p.categoria || '');
    setImagem(p.imagem || '');
    setPrecoUnidade(typeof p.precoUnidade === 'number' && p.precoUnidade > 0 ? String(p.precoUnidade) : '');
    setPrecoCaixa(typeof p.precoCaixa === 'number' && p.precoCaixa > 0 ? String(p.precoCaixa) : '');
    setItensPorCaixa(typeof p.itensPorCaixa === 'number' && p.itensPorCaixa > 0 ? String(p.itensPorCaixa) : '');
    setDestaque(Boolean(p.destaque));
    setDispUnidade((p.disponivelPor || []).includes('unidade'));
    setDispCaixa((p.disponivelPor || []).includes('caixa'));
  }

  async function removeProduct(id?: string) {
    if (!id) return;
    const ok = confirm('Deseja excluir este produto?');
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'produtos', id));
      if (editingId === id) resetForm();
    } catch (err) {
      console.error(err);
      setErrMsg('Não foi possível excluir. Revise as permissões.');
    }
  }

  async function toggleFalta(p: Produto) {
    if (!p.id) return;
    try {
      await updateDoc(doc(db, 'produtos', p.id), { emFalta: !p.emFalta });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error(err);
      setErrMsg(`Não foi possível atualizar estoque: ${msg}`);
    }
  }

  async function handleLogout() {
    await signOut(getAuth());
    router.replace('/admin/login');
  }

  if (user === null) return <div className="p-6 text-white">Carregando…</div>;

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
          <h2 className="mb-4 text-lg font-semibold text-white">
            {editingId ? 'Editar produto' : 'Novo produto'}
          </h2>

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
                  <input
                    type="checkbox"
                    checked={dispUnidade}
                    onChange={(e) => setDispUnidade(e.target.checked)}
                  />
                  Unidade
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={dispCaixa}
                    onChange={(e) => setDispCaixa(e.target.checked)}
                  />
                  Caixa
                </label>
              </div>
            </label>

            <label className="block">
              <span className="text-sm text-gray-300">Destaque (Novidade)</span>
              <div className="mt-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={destaque}
                    onChange={(e) => setDestaque(e.target.checked)}
                  />
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
            {imagem && (
              <div className="mt-2">
                <img
                  src={`/produtos/${imagem}`}
                  alt="preview"
                  className="object-contain w-full rounded max-h-40 bg-black/20"
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
          <h2 className="mb-4 text-lg font-semibold text-white">Produtos cadastrados</h2>

          {produtos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum produto cadastrado ainda.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {produtos.map((p) => (
                <div
                  key={p.id}
                  className={`p-3 rounded-lg shadow bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 ${
                    p.emFalta ? 'opacity-80' : ''
                  }`}
                >
                  <div className="flex items-center justify-center w-full mb-2 overflow-hidden rounded-md aspect-video bg-black/20">
                    {p.imagem ? (
                      <img
                        src={`/produtos/${p.imagem}`}
                        alt={p.nome}
                        className="object-contain max-w-full max-h-full"
                      />
                    ) : (
                      <div className="text-xs text-gray-500">Sem imagem</div>
                    )}
                  </div>

                  <h3 className="font-semibold text-yellow-400">{p.nome}</h3>
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
                    <strong>Preço un.:</strong> {typeof p.precoUnidade === 'number' ? `R$ ${p.precoUnidade.toFixed(2)}` : '—'}{' '}
                    &nbsp;|&nbsp;
                    <strong>Preço caixa:</strong> {typeof p.precoCaixa === 'number' ? `R$ ${p.precoCaixa.toFixed(2)}` : '—'}{' '}
                    &nbsp;|&nbsp;
                    <strong>Itens/caixa:</strong> {typeof p.itensPorCaixa === 'number' ? p.itensPorCaixa : '—'}
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
                        p.emFalta ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-orange-500 text-black hover:bg-orange-600'
                      }`}
                      title={p.emFalta ? 'Marcar como disponível' : 'Marcar como em falta'}
                    >
                      {p.emFalta ? 'Marcar disponível' : 'Marcar em falta'}
                    </button>
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
