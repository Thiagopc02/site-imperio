'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, signOut, User } from 'firebase/auth';
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
  Unsubscribe,
} from 'firebase/firestore';
import {
  FaCheckCircle,
  FaTruck,
  FaFlagCheckered,
  FaTimesCircle,
  FaMapMarkerAlt,
  FaSearch,
  FaUser,
  FaShoppingBag,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaArrowLeft,
  FaWhatsapp,
} from 'react-icons/fa';

type Item = { id?: string; nome?: string; quantidade?: number; preco?: number };
type Endereco = {
  rua?: string; numero?: string; bairro?: string; cidade?: string; cep?: string;
  complemento?: string; pontoReferencia?: string; lat?: number | null; lng?: number | null;
};
type Pedido = {
  id: string; uid: string; nome?: string; total?: number; status?: string; data?: any;
  tipoEntrega?: 'entrega' | 'retirada';
  formaPagamento?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro';
  itens?: Item[]; endereco?: Endereco | null;

  /** campos para envio ao grupo do WhatsApp */
  grupoEnviado?: boolean;
  grupoEnviadoEm?: any;
};

const money = (n: number) => `R$ ${Number(n || 0).toFixed(2)}`;
const toDate = (v: any) => (v?.seconds ? new Date(v.seconds * 1000) : new Date(v ?? NaN));
const fmtDateTime = (d: Date) =>
  isNaN(+d) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const enderecoTexto = (e?: Endereco | null) =>
  e ? [e.rua, e.numero, e.bairro, e.cidade, e.cep, 'Brasil'].filter(Boolean).join(', ') : '';

const ALLOWED_EMAILS = new Set<string>([
  'thiagotorresdeoliveira9@gmail.com',
  'thiagotorres5517@gmail.com',
]);
const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();

async function hasAdminRole(uid: string): Promise<boolean> {
  try {
    const s = await getDoc(doc(db, 'administrador', uid));
    if (s.exists()) {
      const d: any = s.data();
      if (d?.ativo === true) return true;
      if (d?.papel === 'administrador') return true;
      if (d?.role === 'admin') return true;
    }
  } catch {}
  try {
    const s = await getDoc(doc(db, 'admin', uid));
    if (s.exists()) {
      const d: any = s.data();
      if (d?.papel === 'administrador' || d?.role === 'admin' || d?.ativo === true) return true;
    }
  } catch {}
  try {
    const s = await getDoc(doc(db, 'usuarios', uid));
    if (s.exists()) {
      const d: any = s.data();
      if (d?.papel === 'administrador' || d?.role === 'admin') return true;
    }
  } catch {}
  try {
    const s = await getDoc(doc(db, 'usuários', uid));
    if (s.exists()) {
      const d: any = s.data();
      if (d?.papel === 'administrador' || d?.role === 'admin') return true;
    }
  } catch {}
  return false;
}

type ClienteResumo = {
  uid: string;
  nome: string;
  pedidos: number;
  gastoTotal: number;
  ultimaCompra: Date | null;
};

export default function PedidosDetalhadosPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const unsubRef = useRef<Unsubscribe | null>(null);

  const [q, setQ] = useState('');
  const [days, setDays] = useState<7 | 30 | 90 | 0>(30);
  const [statusFilter, setStatusFilter] =
    useState<'todos' | 'andamento' | 'confirmado' | 'rota' | 'entregue' | 'cancelado'>('todos');

  const [loadingRow, setLoadingRow] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null); // para reforçar o brilho no hover do botão WA

  // Auth + gate + assinatura
  useEffect(() => {
    const auth = getAuth();
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      setUser(u);
      if (!u) {
        setIsAdmin(null);
        setPedidos([]);
        router.replace('/admin/login');
        return;
      }

      let admin = ALLOWED_EMAILS.has(normalizeEmail(u.email || ''));
      if (!admin) admin = await hasAdminRole(u.uid);
      setIsAdmin(admin);
      if (!admin) {
        setPedidos([]);
        return;
      }

      const qy = query(collection(db, 'pedidos'), orderBy('data', 'desc'));
      unsubRef.current = onSnapshot(qy, (snap) => {
        const arr: Pedido[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setPedidos(arr);
      });
    });

    return () => {
      unsubAuth();
      if (unsubRef.current) unsubRef.current();
    };
  }, [router]);

  async function handleLogout() {
    await signOut(getAuth());
    router.replace('/admin/login');
  }

  async function alterarStatus(pedidoId: string, novoStatus: string) {
    try {
      setLoadingRow(pedidoId);
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        status: novoStatus,
        atualizadoEm: serverTimestamp(),
      });
    } finally {
      setLoadingRow(null);
    }
  }

  /** Abre o WhatsApp com mensagem pronta e marca o pedido como enviado ao grupo */
  async function enviarParaGrupo(p: Pedido) {
    // Monta descrição de itens
    const itensTxt = (p.itens || [])
      .map((i) => `• ${i.nome || '—'} — ${i.quantidade || 0} × ${money(i.preco || 0)}`)
      .join('\n');

    // Link do Maps (prioriza coordenadas)
    const endTxt = enderecoTexto(p.endereco);
    const hasCoords = typeof p.endereco?.lat === 'number' && typeof p.endereco?.lng === 'number';
    const mapsUrl = hasCoords
      ? `https://www.google.com/maps/search/?api=1&query=${p.endereco!.lat},${p.endereco!.lng}`
      : endTxt
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endTxt)}`
      : '';

    const cabecalho = `*NOVO PEDIDO* #${p.id}`;
    const cliente = `*Cliente:* ${p.nome || '—'}`;
    const entrega = p.tipoEntrega === 'retirada' ? '*Entrega:* Retirada no balcão' : '*Entrega:* Entrega em domicílio';
    const pagamento =
      p.formaPagamento === 'pix' ? 'PIX' :
      p.formaPagamento === 'cartao_credito' ? 'Cartão (Crédito)' :
      p.formaPagamento === 'cartao_debito' ? 'Cartão (Débito)' :
      p.formaPagamento === 'dinheiro' ? 'Dinheiro' : '—';

    const corpo =
      `${cabecalho}\n` +
      `${cliente}\n` +
      `${entrega}\n` +
      (endTxt ? `*Endereço:* ${endTxt}\n` : '') +
      (mapsUrl ? `*Localização:* ${mapsUrl}\n` : '') +
      `*Itens:*\n${itensTxt || '—'}\n` +
      `*Pagamento:* ${pagamento}\n` +
      `*Total:* ${money(p.total || 0)}`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(corpo)}`;

    // Abre o WhatsApp (o usuário escolhe o grupo "Entregas Império")
    window.open(url, '_blank');

    // Marca no Firestore que foi enviado ao grupo
    try {
      await updateDoc(doc(db, 'pedidos', p.id), {
        grupoEnviado: true,
        grupoEnviadoEm: serverTimestamp(),
      });
    } catch {
      // silencioso – se falhar, o estado visual continuará vermelho até recarregar
    }
  }

  const pedidosFiltrados = useMemo(() => {
    let arr = [...pedidos];

    if (days) {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - days);
      const t0 = inicio.getTime();
      arr = arr.filter((p) => toDate(p.data).getTime() >= t0);
    }

    if (statusFilter !== 'todos') {
      const sNeedle =
        statusFilter === 'andamento'
          ? 'andamento'
          : statusFilter === 'confirmado'
          ? 'confirm'
          : statusFilter === 'rota'
          ? 'rota'
          : statusFilter === 'entregue'
          ? 'entregue'
          : 'cancelado';
      arr = arr.filter((p) => (p.status || '').toLowerCase().includes(sNeedle));
    }

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      arr = arr.filter((p) => {
        const inId = p.id.toLowerCase().includes(needle);
        const inNome = (p.nome || '').toLowerCase().includes(needle);
        const inForma = (p.formaPagamento || '').toLowerCase().includes(needle);
        const inAddr = enderecoTexto(p.endereco).toLowerCase().includes(needle);
        return inId || inNome || inForma || inAddr;
      });
    }

    return arr;
  }, [pedidos, days, statusFilter, q]);

  const clientesResumo = useMemo(() => {
    const map = new Map<string, ClienteResumo>();
    for (const p of pedidos) {
      const uid = p.uid;
      if (!map.has(uid)) {
        map.set(uid, {
          uid,
          nome: p.nome || '—',
          pedidos: 0,
          gastoTotal: 0,
          ultimaCompra: null,
        });
      }
      const r = map.get(uid)!;
      r.pedidos += 1;
      r.gastoTotal += p.total || 0;
      const d = toDate(p.data);
      if (!r.ultimaCompra || d > r.ultimaCompra) r.ultimaCompra = d;
    }
    return map;
  }, [pedidos]);

  if (user === null) {
    return <div className="p-6 text-white">Carregando autenticação…</div>;
  }
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
    <main className="min-h-screen p-6 text-white bg-black">
      <header className="flex flex-wrap items-center gap-3 mb-5">
        {/* BOTÃO VOLTAR */}
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 px-3 py-2 font-semibold rounded-lg bg-violet-600 hover:bg-violet-700"
        >
          <FaArrowLeft /> Voltar ao Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-yellow-400">Pedidos (detalhado)</h1>
        <span className="text-sm text-gray-400">Itens, cliente e localização</span>

        <div className="flex items-center gap-2 ml-auto">
          {user?.email && (
            <span className="px-2 py-1 text-xs text-gray-200 border rounded bg-zinc-800 border-zinc-700">
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded hover:bg-red-700"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([7, 30, 90, 0] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={[
              'px-3 py-1.5 rounded-full text-sm border',
              days === d ? 'bg-yellow-400 text-black border-yellow-500' : 'bg-zinc-800 border-zinc-600',
            ].join(' ')}
          >
            {d === 0 ? 'Todos' : d === 7 ? '7 dias' : d === 30 ? '30 dias' : '90 dias'}
          </button>
        ))}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border rounded outline-none bg-zinc-900 border-zinc-700"
        >
          <option value="todos">Todos status</option>
          <option value="andamento">Em andamento</option>
          <option value="confirmado">Confirmados</option>
          <option value="rota">Em rota</option>
          <option value="entregue">Entregues</option>
          <option value="cancelado">Cancelados</option>
        </select>

        <div className="relative ml-auto">
          <FaSearch className="absolute -translate-y-1/2 left-2 top-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por ID, cliente, pagamento ou endereço…"
            className="py-2 pl-8 pr-3 text-sm border rounded outline-none w-80 bg-zinc-900 border-zinc-700"
          />
        </div>
      </div>

      {/* Lista de pedidos detalhados */}
      <div className="space-y-4">
        {pedidosFiltrados.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum pedido encontrado.</p>
        ) : (
          pedidosFiltrados.map((p) => {
            const d = toDate(p.data);
            const resumoCliente = clientesResumo.get(p.uid);
            const hasCoords =
              typeof p.endereco?.lat === 'number' && typeof p.endereco?.lng === 'number';
            const addressText = enderecoTexto(p.endereco);

            return (
              <article key={p.id} className="p-4 border bg-zinc-900 rounded-xl border-zinc-800">
                {/* Cabeçalho */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="px-2 py-1 text-xs font-semibold text-black bg-yellow-400 rounded">
                    #{p.id}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm text-gray-300">
                    <FaCalendarAlt /> {fmtDateTime(d)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm text-gray-300">
                    <FaMoneyBillWave /> {money(p.total || 0)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm text-gray-300">
                    <FaShoppingBag /> {p.tipoEntrega === 'retirada' ? 'Retirada' : 'Entrega'}
                  </span>
                  <span className="ml-auto">
                    <span className="px-2 py-1 text-xs text-black bg-yellow-400 rounded">
                      {p.status || 'Em andamento'}
                    </span>
                  </span>
                </div>

                {/* Grid: Cliente | Itens | Entrega */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* Cliente */}
                  <section className="p-3 border rounded-lg bg-zinc-950/40 border-zinc-800">
                    <h3 className="inline-flex items-center gap-2 mb-2 text-sm font-semibold text-white">
                      <FaUser /> Cliente
                    </h3>
                    <p className="text-sm"><span className="text-gray-400">Nome:</span> {p.nome || '—'}</p>
                    <p className="text-sm"><span className="text-gray-400">UID:</span> {p.uid}</p>
                    {resumoCliente && (
                      <ul className="mt-2 text-sm text-gray-300">
                        <li>Compras: <strong className="text-white">{resumoCliente.pedidos}</strong></li>
                        <li>Gasto total: <strong className="text-white">{money(resumoCliente.gastoTotal)}</strong></li>
                        <li>Última compra: <strong className="text-white">{fmtDateTime(resumoCliente.ultimaCompra || new Date(NaN))}</strong></li>
                      </ul>
                    )}
                  </section>

                  {/* Itens */}
                  <section className="p-3 border rounded-lg bg-zinc-950/40 border-zinc-800">
                    <h3 className="mb-2 text-sm font-semibold text-white">Itens do pedido</h3>
                    {!p.itens || p.itens.length === 0 ? (
                      <p className="text-sm text-gray-400">Sem itens informados.</p>
                    ) : (
                      <ul className="space-y-2">
                        {p.itens.map((it, idx) => (
                          <li
                            key={idx}
                            className="flex justify-between gap-2 pb-1 text-sm border-b border-zinc-800"
                          >
                            <span className="text-gray-200">{it.nome || '—'}</span>
                            <span className="text-gray-400">
                              {it.quantidade || 0} × {money(it.preco || 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-sm text-gray-300">
                      <span className="text-gray-400">Pagamento:</span>{' '}
                      {p.formaPagamento === 'pix' && 'PIX'}
                      {p.formaPagamento === 'cartao_credito' && 'Cartão (Crédito)'}
                      {p.formaPagamento === 'cartao_debito' && 'Cartão (Débito)'}
                      {p.formaPagamento === 'dinheiro' && 'Dinheiro'}
                      {!p.formaPagamento && '—'}
                    </p>
                  </section>

                  {/* Entrega / Localização */}
                  <section className="p-3 border rounded-lg bg-zinc-950/40 border-zinc-800">
                    <h3 className="inline-flex items-center gap-2 mb-2 text-sm font-semibold text-white">
                      <FaMapMarkerAlt /> Entrega
                    </h3>

                    <p className="text-sm">
                      <span className="text-gray-400">Tipo:</span>{' '}
                      {p.tipoEntrega === 'retirada' ? 'Retirada' : 'Entrega'}
                    </p>

                    {p.tipoEntrega !== 'retirada' && (
                      <>
                        <p className="mt-1 text-sm">
                          <span className="text-gray-400">Endereço:</span>{' '}
                          {enderecoTexto(p.endereco) || '—'}
                        </p>

                        {hasCoords ? (
                          <div className="mt-2 overflow-hidden border rounded border-zinc-800">
                            <iframe
                              title={`map-${p.id}`}
                              className="w-full h-48"
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              src={`https://www.google.com/maps?q=${p.endereco!.lat},${p.endereco!.lng}&z=16&output=embed`}
                            />
                          </div>
                        ) : null}

                        <div className="mt-2">
                          {hasCoords ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${p.endereco!.lat},${p.endereco!.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded bg-violet-600 hover:bg-violet-700"
                            >
                              Abrir no Google Maps
                            </a>
                          ) : addressText ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded bg-violet-600 hover:bg-violet-700"
                            >
                              Buscar endereço no Google Maps
                            </a>
                          ) : (
                            <p className="text-xs text-gray-400">Sem localização informada.</p>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                </div>

                {/* Ações */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {/* Botão WhatsApp com glow neon azul claro */}
                  <div
                    className="relative group"
                    onMouseEnter={() => setHoverId(p.id)}
                    onMouseLeave={() => setHoverId(null)}
                  >
                    {/* “Luzes” por trás (gradiente animado) */}
                    <span
                      className="absolute transition-opacity duration-300 pointer-events-none -inset-1 rounded-2xl opacity-90 blur-2xl"
                      style={{
                        background:
                          'radial-gradient(60% 60% at 30% 30%, rgba(56,189,248,0.75), rgba(37,99,235,0.45) 60%, transparent 70%), radial-gradient(50% 50% at 70% 70%, rgba(14,165,233,0.8), rgba(59,130,246,0.45) 60%, transparent 70%)',
                        opacity: hoverId === p.id ? 1 : 0.45,
                        filter: 'saturate(1.4)',
                      }}
                    />
                    <button
                      onClick={() => enviarParaGrupo(p)}
                      className="relative z-10 inline-flex items-center gap-2 px-4 py-2 font-semibold bg-white text-black rounded-2xl border border-black/50 shadow-[inset_0_0_0_3px_#000] transition-transform active:scale-[0.98]"
                      title="Abrir WhatsApp com mensagem + localização"
                      style={{
                        boxShadow:
                          hoverId === p.id
                            ? '0 0 0 3px #0ea5e9 inset, 0 0 20px 6px rgba(56,189,248,0.95), 0 0 70px 26px rgba(59,130,246,0.7)'
                            : '0 0 0 3px #111 inset, 0 0 16px 4px rgba(56,189,248,0.65), 0 0 36px 12px rgba(59,130,246,0.45)',
                      }}
                    >
                      <FaWhatsapp className="text-green-500" />
                      Mandar no grupo de entregas

                      {/* Bolinhas (status): azul = enviado, vermelha = pendente */}
                      <span className="flex items-center ml-2">
                        <span
                          className={[
                            'h-4 w-4 rounded-full border-2 border-black shadow',
                            p.grupoEnviado ? 'bg-sky-400' : 'bg-red-500',
                          ].join(' ')}
                        />
                        <span className="w-4 h-4 ml-1 bg-white border-2 border-black rounded-full shadow" />
                      </span>
                    </button>
                  </div>

                  <ActionBtn
                    tone="success"
                    disabled={loadingRow === p.id}
                    onClick={() => alterarStatus(p.id, 'Confirmado')}
                    title="Confirmar pedido"
                  >
                    <FaCheckCircle /> Confirmar
                  </ActionBtn>
                  <ActionBtn
                    tone="info"
                    disabled={loadingRow === p.id}
                    onClick={() => alterarStatus(p.id, 'Em rota')}
                    title="Saiu para entrega"
                  >
                    <FaTruck /> Em rota
                  </ActionBtn>
                  <ActionBtn
                    tone="ok"
                    disabled={loadingRow === p.id}
                    onClick={() => alterarStatus(p.id, 'Entregue')}
                    title="Marcar como entregue"
                  >
                    <FaFlagCheckered /> Entregue
                  </ActionBtn>
                  <ActionBtn
                    tone="danger"
                    disabled={loadingRow === p.id}
                    onClick={() => alterarStatus(p.id, 'Cancelado')}
                    title="Cancelar pedido"
                  >
                    <FaTimesCircle /> Cancelar
                  </ActionBtn>
                </div>
              </article>
            );
          })
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Mostrando {pedidosFiltrados.length} pedido(s){' '}
        {days ? `nos últimos ${days} dias.` : 'no período selecionado.'}
      </p>
    </main>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  title,
  tone = 'info',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: 'success' | 'info' | 'ok' | 'danger';
}) {
  const base = 'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded transition-colors';
  const map: Record<string, string> = {
    success: 'bg-green-600 hover:bg-green-700 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
    ok: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
  return (
    <button
      onClick={onClick}
      disabled={!!disabled}
      title={title}
      className={[base, map[tone], disabled ? 'opacity-60 cursor-not-allowed hover:bg-inherit' : ''].join(' ')}
    >
      {children}
    </button>
  );
}
