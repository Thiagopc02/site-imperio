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

type FireTimestampLike = { seconds?: number } | Date | null | undefined;

type Pedido = {
  id: string;
  uid: string;
  total?: number;
  data?: FireTimestampLike;
  formaPagamento?: string;
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

const COLORS = ['#22c55e', '#eab308', '#60a5fa', '#a78bfa'];

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

  /* ===== AUTH ===== */
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
          lista.push({ ...(d.data() as Pedido), id: d.id });
        });
        setPedidos(lista);
      });
    });

    return () => {
      unsub();
      if (pedidosUnsubRef.current) pedidosUnsubRef.current();
    };
  }, [router]);

  /* ===== KPIs ===== */
  const totalVendido = useMemo(
    () => pedidos.reduce((acc, p) => acc + (p.total || 0), 0),
    [pedidos]
  );

  const clientes = useMemo(
    () => new Set(pedidos.map((p) => p.uid)).size,
    [pedidos]
  );

  /* ===== CHARTS ===== */
  const vendasPorDia = useMemo(() => {
    const map = new Map<string, number>();
    pedidos.forEach((p) => {
      const d = toDate(p.data).toLocaleDateString('pt-BR');
      map.set(d, (map.get(d) || 0) + (p.total || 0));
    });
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [pedidos]);

  const pagamentos = useMemo(() => {
    const map = new Map<string, number>();
    pedidos.forEach((p) => {
      const key = p.formaPagamento || 'Outros';
      map.set(key, (map.get(key) || 0) + (p.total || 0));
    });
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [pedidos]);

  async function handleLogout() {
    await signOut(getAuth());
    router.replace('/admin/login');
  }

  if (isAdmin === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <button onClick={handleLogout} className="px-6 py-3 bg-red-600 rounded">
          Sair
        </button>
      </div>
    );
  }

  /* ================= RENDER ================= */

  return (
    <div className="min-h-screen p-8 text-white bg-black">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold text-yellow-400">
          Painel Administrativo
        </h1>

        <Link
          href="/admin/dashboard/pedidos"
          className="flex items-center gap-2 px-5 py-3 ml-auto shadow-lg bg-violet-600 rounded-xl"
        >
          <FaListAlt /> Pedidos
        </Link>

        <Link
          href="/admin/produtosADM"
          className="flex items-center gap-2 px-5 py-3 bg-green-600 shadow-lg rounded-xl"
        >
          <FaBoxOpen /> Produtos
        </Link>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 shadow-lg rounded-xl"
        >
          Sair
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <KpiCard
          title="Total Vendido"
          value={money(totalVendido)}
          icon={<FaMoneyBillWave />}
          gradient="from-green-500/20 to-green-900/10"
        />
        <KpiCard
          title="Clientes Ativos"
          value={clientes}
          icon={<FaUsers />}
          gradient="from-blue-500/20 to-blue-900/10"
        />
      </div>

      {/* GRÁFICO */}
      <div className="p-6 mt-10 bg-zinc-900 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">
          Vendas por dia
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={vendasPorDia}>
            <XAxis stroke="#71717a" dataKey="name" />
            <YAxis stroke="#71717a" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#facc15"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* PAGAMENTOS */}
      <div className="p-6 mt-10 bg-zinc-900 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">
          Métodos de pagamento
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={pagamentos}
              dataKey="total"
              nameKey="name"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={4}
            >
              {pagamentos.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ReviewsModeration />
    </div>
  );
}

/* ================= COMPONENTS ================= */

function KpiCard({
  title,
  value,
  icon,
  gradient,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div
      className={`relative p-6 rounded-2xl bg-gradient-to-br ${gradient}
      shadow-[0_20px_50px_rgba(0,0,0,0.6)]
      border border-white/5`}
    >
      <p className="text-sm text-gray-400">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <div className="absolute text-3xl text-yellow-400 top-6 right-6">
        {icon}
      </div>
    </div>
  );
}
