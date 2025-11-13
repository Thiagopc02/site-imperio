'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { db } from '@/firebase/config';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  type DocumentData,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore';

/* ====== Gate de Admin (mesma base dos outros) ====== */
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

/* ====== Tipos ====== */
type Endereco = {
  rua?: string; numero?: string; bairro?: string; cidade?: string; cep?: string;
  complemento?: string; pontoReferencia?: string; lat?: number; lng?: number; accuracy?: number;
};

type Item = {
  id: string; nome: string; tipo?: string; quantidade: number; preco: number;
};

type MPTransactionData = {
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;     // boleto
  external_resource_url?: string;
};

type MPPointOfInteraction = { transaction_data?: MPTransactionData };
type MPCardInfo = { last_four_digits?: string; holder_name?: string; };
type MPCharge = { card?: MPCardInfo };
type MPPayment = {
  id?: string | number;
  status?: string;               // approved, pending, rejected...
  payment_type_id?: string;      // credit_card, debit_card, pix, ticket (boleto)
  transaction_amount?: number;
  statement_descriptor?: string;
  date_approved?: string | null;
  point_of_interaction?: MPPointOfInteraction;
  charges_details?: MPCharge[];
};

type Pedido = {
  id: string;
  uid: string;
  nome: string;
  telefone?: string;
  email?: string;
  tipoEntrega: 'entrega' | 'retirada';
  formaPagamento?: string;
  status: string;
  troco?: number | null;
  total: number;
  itens: Item[];
  endereco?: Endereco | null;
  createdAt?: unknown;   // Firestore Timestamp
  data?: string;         // ISO legacy
  mp_payment_id?: string | number | null;
  mp_snapshot?: MPPayment | null; // comprovante salvo via webhook
};

/* ====== Utils ====== */
function tsOrIsoToMillis(p: Pick<Pedido, 'createdAt' | 'data'>): number {
  const ts = p.createdAt as { seconds?: number; nanoseconds?: number } | undefined;
  if (ts && typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + (ts.nanoseconds ? ts.nanoseconds / 1e6 : 0);
  }
  if (p.data) {
    const t = Date.parse(p.data);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

const STATUS = [
  'Aguardando pagamento',
  'Pago',
  'Em andamento',
  'Em rota',
  'Entregue',
  'Cancelado',
] as const;

function money(n: number | undefined) {
  return `R$ ${(n ?? 0).toFixed(2)}`.replace('.', ',');
}

/* ====== Página ====== */
export default function AdminPedidosPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const unsubRef = useRef<Unsubscribe | null>(null);

  const [periodo, setPeriodo] = useState<'7d' | '30d' | '90d' | 'all'>('7d');
  const [q, setQ] = useState('');

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setErr(null);

      if (!u) {
        setIsAdmin(null);
        if (unsubRef.current) unsubRef.current();
        router.replace('/admin/login');
        return;
      }

      const mail = normalizeEmail(u.email || '');
      let admin = ALLOWED_EMAILS.has(mail);
      if (!admin) admin = await hasAdminRole(u.uid);
      setIsAdmin(admin);

      if (!admin) {
        setPedidos([]);
        if (unsubRef.current) unsubRef.current();
        return;
      }

      try {
        const qy = query(collection(db, 'pedidos'), orderBy('createdAt', 'desc'));
        unsubRef.current = onSnapshot(
          qy,
          (snap) => {
            const arr: Pedido[] = [];
            snap.forEach((d) => {
              const data = d.data() as DocumentData;

              arr.push({
                id: d.id,
                uid: String(data.uid ?? ''),
                nome: String(data.nome ?? ''),
                telefone: data.telefone ? String(data.telefone) : '',
                email: data.email ? String(data.email) : (data.payerEmail ? String(data.payerEmail) : ''),
                tipoEntrega: (data.tipoEntrega === 'entrega' ? 'entrega' : 'retirada'),
                formaPagamento: data.formaPagamento ? String(data.formaPagamento) : (data.payment_type ? String(data.payment_type) : ''),
                status: String(data.status ?? 'Aguardando pagamento'),
                troco: typeof data.troco === 'number' ? data.troco : null,
                total: Number(data.total ?? 0),
                itens: Array.isArray(data.itens) ? (data.itens as Item[]) : [],
                endereco: (data.endereco as Endereco | null) ?? null,
                createdAt: data.createdAt ?? serverTimestamp(),
                data: data.data ? String(data.data) : undefined,
                mp_payment_id: data.mp_payment_id ?? null,
                mp_snapshot: (data.mp_snapshot as MPPayment | null) ?? null,
              });
            });

            arr.sort((a, b) => tsOrIsoToMillis(b) - tsOrIsoToMillis(a));
            setPedidos(arr);
          },
          (e: FirestoreError) => setErr(`Erro ao listar pedidos: ${e.message}`)
        );
      } catch (e) {
        setErr('Falha ao carregar pedidos.');
      }
    });

    return () => {
      unsub();
      if (unsubRef.current) unsubRef.current();
    };
  }, [router]);

  const agora = Date.now();
  const cutoff = useMemo(() => {
    switch (periodo) {
      case '7d': return agora - 7 * 24 * 3600 * 1000;
      case '30d': return agora - 30 * 24 * 3600 * 1000;
      case '90d': return agora - 90 * 24 * 3600 * 1000;
      default: return 0;
    }
  }, [agora, periodo]);

  const filtrados = useMemo(() => {
    const qlc = q.trim().toLowerCase();
    return pedidos.filter((p) => {
      const t = tsOrIsoToMillis(p);
      if (cutoff && t && t < cutoff) return false;
      if (!qlc) return true;

      const alvo = [
        p.id, p.nome, p.email, p.telefone, p.formaPagamento, p.status,
        p.endereco?.rua, p.endereco?.bairro, p.endereco?.cidade, p.endereco?.cep,
      ].filter(Boolean).join(' ').toLowerCase();

      return alvo.includes(qlc);
    });
  }, [pedidos, cutoff, q]);

  async function mudarStatus(id: string, status: string) {
    try {
      await updateDoc(doc(db, 'pedidos', id), {
        status,
        statusUpdatedAt: serverTimestamp(),
      });
    } catch {
      alert('Não foi possível atualizar o status.');
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
        <h1 className="text-2xl font-bold text-yellow-400">Pedidos (detalhado)</h1>
        <span className="text-sm text-gray-400">Itens, cliente, localização e comprovante</span>

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

      {err && (
        <div className="p-3 mb-4 text-sm text-red-200 border rounded bg-red-600/20 border-red-600/40">
          {err}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['7d', '30d', '90d', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={[
              'px-3 py-1.5 rounded-full text-sm',
              periodo === p ? 'bg-yellow-400 text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700',
            ].join(' ')}
          >
            {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : 'Todos'}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por ID, cliente, pagamento, endereço…"
          className="flex-1 min-w-[220px] px-3 py-2 text-sm text-white border rounded bg-zinc-900 border-zinc-700"
        />
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum pedido encontrado {periodo !== 'all' ? 'no período selecionado' : ''}.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtrados.map((p) => {
            const tx = p.mp_snapshot?.point_of_interaction?.transaction_data;
            const card = p.mp_snapshot?.charges_details?.[0]?.card;
            const isPix = p.mp_snapshot?.payment_type_id === 'pix' || /pix/i.test(p.formaPagamento ?? '');
            const isBoleto = p.mp_snapshot?.payment_type_id === 'ticket' || /boleto/i.test(p.formaPagamento ?? '');
            const isCard = p.mp_snapshot?.payment_type_id?.includes('card') || /cart[aã]o/i.test(p.formaPagamento ?? '');

            return (
              <div
                key={p.id}
                className="p-4 rounded-xl ring-1 ring-white/10 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-1 font-mono text-xs border rounded bg-zinc-800 border-zinc-700">#{p.id}</span>
                  <span className="px-2 py-1 text-xs border rounded bg-amber-500/15 text-amber-300 border-amber-500/30">
                    {p.tipoEntrega === 'entrega' ? '🚚 Entrega' : '🏪 Retirada'}
                  </span>
                  <span className="px-2 py-1 text-xs border rounded bg-sky-500/15 text-sky-300 border-sky-500/30">
                    {p.formaPagamento || '—'}
                  </span>
                  {p.mp_payment_id && (
                    <span className="px-2 py-1 text-xs border rounded bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                      MP #{String(p.mp_payment_id)}
                    </span>
                  )}
                  <span className="ml-auto text-sm font-semibold">
                    Total: <span className="text-yellow-400">{money(p.total)}</span>
                  </span>
                </div>

                <div className="grid gap-4 mt-3 md:grid-cols-3">
                  <div className="text-sm">
                    <div className="font-semibold text-yellow-400">Cliente</div>
                    <div>{p.nome || '—'}</div>
                    <div className="text-zinc-300">{p.email || '—'}</div>
                    <div className="text-zinc-300">{p.telefone || '—'}</div>
                  </div>

                  <div className="text-sm md:col-span-2">
                    <div className="font-semibold text-yellow-400">Itens</div>
                    <ul className="mt-1 space-y-0.5">
                      {p.itens?.map((it, i) => (
                        <li key={`${it.id}-${i}`} className="text-zinc-200">
                          {it.nome} <span className="text-zinc-400">({it.tipo || 'unidade'})</span> × {it.quantidade}
                          {' — '}<span className="text-zinc-300">{money(it.preco)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {p.endereco && (
                  <div className="mt-3 text-sm">
                    <div className="font-semibold text-yellow-400">Endereço</div>
                    <div className="text-zinc-200">
                      {p.endereco.rua}, {p.endereco.numero} — {p.endereco.bairro}, {p.endereco.cidade} — {p.endereco.cep}
                    </div>
                    {p.endereco.pontoReferencia && (
                      <div className="text-zinc-300">Ref.: {p.endereco.pontoReferencia}</div>
                    )}
                    {typeof p.endereco.lat === 'number' && typeof p.endereco.lng === 'number' && (
                      <a
                        className="inline-flex items-center gap-2 px-3 py-1.5 mt-2 text-xs font-semibold text-black bg-yellow-400 rounded hover:bg-yellow-500"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://www.google.com/maps?q=${p.endereco.lat},${p.endereco.lng}&z=17`}
                      >
                        Ver no mapa
                      </a>
                    )}
                  </div>
                )}

                {/* Comprovante / Dados de pagamento */}
                <div className="p-3 mt-4 rounded-lg ring-1 ring-white/10 bg-black/25">
                  <div className="mb-2 text-sm font-semibold text-yellow-400">Comprovante</div>

                  {!p.mp_snapshot && (
                    <div className="text-sm text-zinc-400">
                      Aguardando dados do pagamento (webhook do Mercado Pago).
                    </div>
                  )}

                  {p.mp_snapshot && (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="text-sm">
                        <div>Status MP: <span className="font-semibold">{p.mp_snapshot.status ?? '—'}</span></div>
                        <div>Tipo: {p.mp_snapshot.payment_type_id ?? '—'}</div>
                        {isCard && (
                          <div>
                            Cartão: •••• {card?.last_four_digits ?? '—'}
                            {card?.holder_name ? ` — ${card.holder_name}` : ''}
                          </div>
                        )}
                        {p.mp_snapshot.date_approved && (
                          <div>Aprovado em: {new Date(p.mp_snapshot.date_approved).toLocaleString()}</div>
                        )}
                      </div>

                      {/* PIX */}
                      {isPix && (
                        <div className="text-sm md:col-span-2">
                          <div className="mb-1">PIX Copia e Cola:</div>
                          <textarea
                            readOnly
                            value={tx?.qr_code ?? ''}
                            className="w-full p-2 text-xs border rounded bg-zinc-900 border-zinc-700"
                            rows={3}
                          />
                          {tx?.qr_code_base64 && (
                            <img
                              src={`data:image/png;base64,${tx.qr_code_base64}`}
                              alt="QR Code PIX"
                              className="w-40 h-40 p-1 mt-2 bg-white rounded"
                            />
                          )}
                        </div>
                      )}

                      {/* Boleto */}
                      {isBoleto && (
                        <div className="text-sm md:col-span-2">
                          <div className="mb-2">Boleto:</div>
                          {tx?.ticket_url ? (
                            <a
                              target="_blank" rel="noopener noreferrer"
                              href={tx.ticket_url}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-black rounded bg-amber-400 hover:bg-amber-500"
                            >
                              Abrir boleto (ticket_url)
                            </a>
                          ) : (
                            <div className="text-zinc-400">ticket_url indisponível.</div>
                          )}
                        </div>
                      )}

                      {/* Link genérico do comprovante, se existir */}
                      {!isPix && !isBoleto && p.mp_snapshot?.point_of_interaction?.transaction_data?.external_resource_url && (
                        <div className="text-sm md:col-span-2">
                          <a
                            target="_blank" rel="noopener noreferrer"
                            href={p.mp_snapshot.point_of_interaction.transaction_data.external_resource_url}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-black rounded bg-emerald-400 hover:bg-emerald-500"
                          >
                            Abrir comprovante
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <span className="text-sm">Status:</span>
                  <select
                    value={p.status || 'Aguardando pagamento'}
                    onChange={(e) => mudarStatus(p.id, e.target.value)}
                    className="px-2 py-1 text-sm text-white border rounded bg-zinc-900 border-zinc-700"
                  >
                    {STATUS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
