'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db } from '@/firebase/config';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
} from 'firebase/firestore';
import {
  FaMoneyBillWave,
  FaShoppingCart,
  FaUsers,
  FaListAlt,
  FaPlus,
  FaBoxOpen, // ícone para o botão de produtos
} from 'react-icons/fa';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

// >>> IMPORTA O BLOCO DE MODERAÇÃO <<<
import ReviewsModeration from './ReviewsModeration';

// allowlist direta por e-mail (opcional)
const ALLOWED_EMAILS = new Set<string>([
  'thiagotorresdeoliveira9@gmail.com',
  'thiagotorres5517@gmail.com',
]);

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
};

const toDate = (v: any) => (v?.seconds ? new Date(v.seconds * 1000) : new Date(v ?? NaN));
const money = (n: number) => `R$ ${n.toFixed(2)}`;
const COLORS = ['#22c55e', '#eab308', '#60a5fa', '#f43f5e', '#a78bfa', '#34d399'];

// normaliza e-mail para comparação
const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();

// Confere papel de admin no Firestore em múltiplos modelos
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

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const pedidosUnsubRef = useRef<Unsubscribe | null>(null);

  // filtros usados apenas para KPIs/gráficos
  const [days, setDays] = useState<7 | 30 | 90 | 0>(30);

  // Auth + gate de admin + inscrição em pedidos
  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (pedidosUnsubRef.current) {
        pedidosUnsubRef.current();
        pedidosUnsubRef.current = null;
      }

      setUser(u);
      setErrMsg(null);

      if (!u) {
        setIsAdmin(null);
        setPedidos([]);
        router.replace('/admin/login');
        return;
      }

      const mail = normalizeEmail(u.email || '');
      let admin = ALLOWED_EMAILS.has(mail);
      if (!admin) admin = await hasAdminRole(u.uid);

      setIsAdmin(admin);

      if (!admin) {
        setPedidos([]);
        return;
      }

      // Real-time: só para computar indicadores/gráficos
      try {
        const qy = query(collection(db, 'pedidos'), orderBy('data', 'desc'));
        pedidosUnsubRef.current = onSnapshot(
          qy,
          (s) => {
            const lista: Pedido[] = [];
            s.forEach((d) => lista.push({ id: d.id, ...(d.data() as any) }));
            setPedidos(lista);
          },
          () => setErrMsg('Sem permissão para ler pedidos. Verifique as regras do Firestore e o papel do usuário.')
        );
      } catch {
        setErrMsg('Falha ao carregar pedidos. Verifique regras de segurança.');
      }
    });

    return () => {
      unsub();
      if (pedidosUnsubRef.current) pedidosUnsubRef.current();
    };
  }, [router]);

  // Aplica somente o filtro de período (dias)
  const pedidosPeriodo = useMemo(() => {
    if (!days) return [...pedidos];
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - days);
    const t0 = inicio.getTime();
    return pedidos.filter((p) => toDate(p.data).getTime() >= t0);
  }, [pedidos, days]);

  const kpi = useMemo(() => {
    const totalVendido = pedidosPeriodo
      .filter((p) => (p.status || '').toLowerCase() !== 'cancelado')
      .reduce((acc, p) => acc + (p.total || 0), 0);

    const emAndamento = pedidosPeriodo.filter((p) => {
      const s = (p.status || '').toLowerCase();
      return s.includes('andamento') || s.includes('confirm') || s.includes('rota');
    }).length;

    const clientes = new Set(pedidosPeriodo.map((p) => p.uid)).size;

    return { totalVendido, emAndamento, clientes };
  }, [pedidosPeriodo]);

  const vendasPorDia = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pedidosPeriodo) {
      if ((p.status || '').toLowerCase() === 'cancelado') continue;
      const d = toDate(p.data);
      const k = d.toLocaleDateString('pt-BR');
      map.set(k, (map.get(k) || 0) + (p.total || 0));
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total: Number(total.toFixed(2)) }));
  }, [pedidosPeriodo]);

  const metodosPagamento = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pedidosPeriodo) {
      if ((p.status || '').toLowerCase() === 'cancelado') continue;
      const key =
        p.formaPagamento === 'pix' ? 'PIX' :
        p.formaPagamento === 'cartao_credito' ? 'Crédito' :
        p.formaPagamento === 'cartao_debito' ? 'Débito' : 'Outros';
      map.set(key, (map.get(key) || 0) + (p.total || 0));
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total: Number(total.toFixed(2)) }));
  }, [pedidosPeriodo]);

  const topProdutos = useMemo(() => {
    const mapQtd = new Map<string, number>();
    const mapValor = new Map<string, number>();
    for (const p of pedidosPeriodo) {
      if (!p.itens) continue;
      for (const it of p.itens) {
        const nome = it.nome || '—';
        mapQtd.set(nome, (mapQtd.get(nome) || 0) + (it.quantidade || 0));
        mapValor.set(nome, (mapValor.get(nome) || 0) + (it.preco || 0) * (it.quantidade || 0));
      }
    }
    return Array.from(mapQtd.entries())
      .map(([name, qtd]) => ({ name, qtd, valor: Number((mapValor.get(name) || 0).toFixed(2)) }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);
  }, [pedidosPeriodo]);

  async function handleLogout() {
    await signOut(getAuth());
    router.replace('/admin/login');
  }

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
    <div className="min-h-screen p-6 text-white bg-black">
      {/* Topbar com Sair + CTAs */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-3xl font-bold text-yellow-400">Painel Administrativo</h1>
        <span className="text-sm text-gray-400">Atualização em tempo real</span>

        {/* CTA: ver pedidos detalhados */}
        <Link
          href="/admin/dashboard/pedidos"
          className="inline-flex items-center gap-2 px-5 py-3 ml-auto text-sm font-extrabold rounded-2xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
          title="Abrir a página de pedidos detalhados"
        >
          <FaListAlt className="text-lg" />
          Ver pedidos detalhados
        </Link>

        {/* NOVO: CTA Gerenciar Produtos (vai para a página dedicada) */}
        <Link
          href="/admin/produtosADM"
          title="Adicionar/editar produtos"
          className="inline-flex items-center gap-2 px-5 py-3 text-sm font-extrabold rounded-2xl focus:outline-none focus:ring-2"
          style={{
            background:
              'linear-gradient(135deg, #22c55e 0%, #84cc16 45%, #facc15 100%)',
            boxShadow:
              '0 8px 24px rgba(34,197,94,.35), inset 0 0 12px rgba(255,255,255,.16)',
          }}
        >
          <FaBoxOpen className="text-base" />
          Gerenciar produtos
        </Link>

        {/* Usuário + Sair */}
        <div className="flex items-center gap-2">
          {user?.email && (
            <span className="px-2 py-1 text-xs text-gray-200 border rounded bg-zinc-800 border-zinc-700">
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded hover:bg-red-700"
            title="Sair da área administrativa"
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

      {/* Filtro de período (somente dias) */}
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
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-3">
        <ResumoCard
          title="Resumo de Vendas"
          icon={<FaMoneyBillWave className="text-xl text-green-400" />}
          value={money(kpi.totalVendido)}
          subtitle="Total acumulado (sem cancelados)"
        />
        <ResumoCard
          title="Pedidos em andamento"
          icon={<FaShoppingCart className="text-xl text-yellow-400" />}
          value={kpi.emAndamento}
          subtitle="Aguardando / Confirmados / Em rota"
        />
        <ResumoCard
          title="Clientes Ativos"
          icon={<FaUsers className="text-xl text-blue-400" />}
          value={kpi.clientes}
          subtitle={`Últimos ${days === 0 ? 'todos' : days} dias`}
        />
      </div>

      {/* Vendas por dia */}
      <Section title="Vendas por dia">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={vendasPorDia}>
            <XAxis dataKey="name" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#eab308" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* Pagamentos + Top produtos */}
      <div className="grid grid-cols-1 gap-4 mt-6 lg:grid-cols-2">
        <Section title="Métodos de pagamento">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={metodosPagamento} dataKey="total" nameKey="name" outerRadius={110} label>
                {metodosPagamento.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Top produtos (qtd)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProdutos}>
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Bar dataKey="qtd">
                {topProdutos.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <ul className="mt-3 text-xs text-gray-300 list-disc list-inside">
            {topProdutos.map((p) => (
              <li key={p.name}>
                <span className="text-white">{p.name}</span> — {p.qtd} un • {money(p.valor)}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* >>> Bloco de aprovação de avaliações <<< */}
      <ReviewsModeration />
    </div>
  );
}

function ResumoCard({
  title,
  icon,
  value,
  subtitle,
}: {
  title: string;
  icon: React.ReactNode;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div className="p-4 shadow bg-zinc-900 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-400">{subtitle}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 shadow bg-zinc-900 rounded-xl">
      <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}
