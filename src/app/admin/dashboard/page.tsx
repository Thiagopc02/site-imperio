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
  FaUsers,
  FaListAlt,
  FaBoxOpen,
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
} from 'recharts';

import ReviewsModeration from './ReviewsModeration';

/* ================= CONFIG ================= */

const ALLOWED_EMAILS = new Set<string>([
  'thiagotorresdeoliveira9@gmail.com',
  'thiagotorres5517@gmail.com',
]);

/* ================= TYPES ================= */

type Item = {
  nome?: string;
  quantidade?: number;
  preco?: number;
};

type Endereco = {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
};

type FireTimestampLike = { seconds?: number } | Date | null | undefined;

type Pedido = {
  id: string;
  uid: string;
  total?: number;
  status?: string;
  data?: FireTimestampLike;
  formaPagamento?: string;
  itens?: Item[];
  endereco?: Endereco | null;
};

/* ================= HELPERS ================= */

const toDate = (v: FireTimestampLike): Date => {
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && typeof v.seconds === 'number') {
    return new Date(v.seconds * 1000);
  }
  return new Date(NaN);
};

const money = (n: number) => `R$ ${n.toFixed(2)}`;

const COLORS = ['#22c55e', '#eab308', '#60a5fa', '#f43f5e', '#a78bfa'];

const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').trim().toLowerCase();

async function hasAdminRole(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (snap.exists()) {
      const d = snap.data() as { role?: string; papel?: string };
      return d.role === 'admin' || d.papel === 'administrador';
    }
  } catch {}
  return false;
}

/* ================= PAGE ================= */

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const pedidosUnsubRef = useRef<Unsubscribe | null>(null);

  const [days] = useState<7 | 30 | 90 | 0>(30);

  /* ===== AUTH + FIRESTORE ===== */
  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (pedidosUnsubRef.current) pedidosUnsubRef.current();

      if (!u) {
        router.replace('/admin/login');
        return;
      }

      setUser(u);

      const emailOk = ALLOWED_EMAILS.has(normalizeEmail(u.email || ''));
      const roleOk = await hasAdminRole(u.uid);

      if (!emailOk && !roleOk) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);

      const qy = query(collection(db, 'pedidos'), orderBy('data', 'desc'));
      pedidosUnsubRef.current = onSnapshot(qy, (s) => {
        const lista: Pedido[] = [];
        s.forEach((d) => {
          const data = d.data() as Omit<Pedido, 'id'>;
          lista.push({ ...data, id: d.id });
        });
        setPedidos(lista);
      });
    });

    return () => {
      unsub();
      if (pedidosUnsubRef.current) pedidosUnsubRef.current();
    };
  }, [router]);

  /* ===== FILTRO PERÍODO ===== */
  const pedidosPeriodo = useMemo(() => {
    if (!days) return pedidos;
    const limite = new Date();
    limite.setDate(limite.getDate() - days);
    return pedidos.filter(
      (p) => toDate(p.data).getTime() >= limite.getTime()
    );
  }, [pedidos, days]);

  /* ===== KPIs ===== */
  const kpi = useMemo(() => {
    const totalVendido = pedidosPeriodo.reduce(
      (acc, p) => acc + (p.total || 0),
      0
    );
    const clientes = new Set(pedidosPeriodo.map((p) => p.uid)).size;
    return { totalVendido, clientes };
  }, [pedidosPeriodo]);

  /* ===== GRÁFICOS ===== */
  const vendasPorDia = useMemo(() => {
    const map = new Map<string, number>();
    pedidosPeriodo.forEach((p) => {
      const d = toDate(p.data).toLocaleDateString('pt-BR');
      map.set(d, (map.get(d) || 0) + (p.total || 0));
    });
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [pedidosPeriodo]);

  const pagamentos = useMemo(() => {
    const map = new Map<string, number>();
    pedidosPeriodo.forEach((p) => {
      const key = p.formaPagamento || 'Outros';
      map.set(key, (map.get(key) || 0) + (p.total || 0));
    });
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [pedidosPeriodo]);

  async function handleLogout() {
    await signOut(getAuth());
    router.replace('/admin/login');
  }

  if (isAdmin === false) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white bg-black">
        <button onClick={handleLogout} className="px-6 py-3 bg-red-600 rounded">
          Sair
        </button>
      </div>
    );
  }

  /* ================= RENDER ================= */

  return (
    <div className="min-h-screen p-6 text-white bg-black">
      {/* Topbar */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-yellow-400">
          Painel Administrativo
        </h1>

        <Link
          href="/admin/dashboard/pedidos"
          className="flex items-center gap-2 px-5 py-3 ml-auto bg-violet-600 rounded-xl"
        >
          <FaListAlt /> Pedidos
        </Link>

        <Link
          href="/admin/produtosADM"
          className="flex items-center gap-2 px-5 py-3 bg-green-600 rounded-xl"
        >
          <FaBoxOpen /> Produtos
        </Link>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 rounded"
        >
          Sair
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ResumoCard
          title="Total vendido"
          value={money(kpi.totalVendido)}
          icon={<FaMoneyBillWave />}
        />
        <ResumoCard
          title="Clientes ativos"
          value={kpi.clientes}
          icon={<FaUsers />}
        />
      </div>

      {/* Vendas por dia */}
      <div className="mt-8">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={vendasPorDia}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line dataKey="total" stroke="#eab308" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pagamentos */}
      <div className="mt-8">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={pagamentos} dataKey="total" nameKey="name" label>
              {pagamentos.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ReviewsModeration />
    </div>
  );
}

/* ================= COMPONENTS ================= */

function ResumoCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-6 bg-zinc-900 rounded-xl">
      <div>
        <p className="text-gray-400">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <div className="text-3xl text-yellow-400">{icon}</div>
    </div>
  );
}
