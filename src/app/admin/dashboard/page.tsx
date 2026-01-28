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
  updateDoc,
  Timestamp,
} from 'firebase/firestore';

import {
  FaMoneyBillWave,
  FaUsers,
  FaListAlt,
  FaBoxOpen,
  FaBirthdayCake,
  FaGift,
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

type FireTimestampLike = Timestamp | Date | null | undefined;

type Pedido = {
  id: string;
  uid: string;
  total?: number;
  data?: FireTimestampLike;
  formaPagamento?: string;
};

type Usuario = {
  id: string;
  nome?: string;
  telefone?: string;
  dataNascimento?: Timestamp;
  cupomAniversarioEnviado?: boolean;
};

/* ================= HELPERS ================= */

const toDate = (v: FireTimestampLike): Date => {
  if (v instanceof Date) return v;
  if (v && 'seconds' in v) return new Date(v.seconds * 1000);
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
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const pedidosUnsubRef = useRef<Unsubscribe | null>(null);
  const usuariosUnsubRef = useRef<Unsubscribe | null>(null);

  /* ===== AUTH ===== */
  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (u) => {
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

      pedidosUnsubRef.current = onSnapshot(
        query(collection(db, 'pedidos'), orderBy('data', 'desc')),
        (s) => {
          const lista: Pedido[] = [];
          s.forEach((d) => lista.push({ ...(d.data() as Pedido), id: d.id }));
          setPedidos(lista);
        }
      );

      usuariosUnsubRef.current = onSnapshot(
        collection(db, 'usuarios'),
        (s) => {
          const lista: Usuario[] = [];
          s.forEach((d) => lista.push({ ...(d.data() as Usuario), id: d.id }));
          setUsuarios(lista);
        }
      );
    });

    return () => {
      unsub();
      pedidosUnsubRef.current?.();
      usuariosUnsubRef.current?.();
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

  /* ===== ANIVERSARIANTES DA SEMANA ===== */
  const aniversariantesSemana = useMemo(() => {
    const hoje = new Date();
    const fim = new Date();
    fim.setDate(hoje.getDate() + 7);

    return usuarios.filter((u) => {
      if (!u.dataNascimento) return false;

      const nasc = toDate(u.dataNascimento);
      const prox = new Date(
        hoje.getFullYear(),
        nasc.getMonth(),
        nasc.getDate()
      );

      if (prox < hoje) prox.setFullYear(hoje.getFullYear() + 1);

      return prox >= hoje && prox <= fim;
    });
  }, [usuarios]);

  function enviarCupom(u: Usuario) {
    if (!u.telefone) return;

    const msg = encodeURIComponent(
      `🎉 Parabéns ${u.nome || ''}!\n\nA Império Bebidas te presenteia com *10% OFF* 🎁\n\nUse o cupom: *IMPERIO10*`
    );

    window.open(`https://wa.me/${u.telefone}?text=${msg}`, '_blank');

    updateDoc(doc(db, 'usuarios', u.id), {
      cupomAniversarioEnviado: true,
    });
  }

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
          className="px-4 py-2 bg-red-600 rounded-xl"
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
        />
        <KpiCard
          title="Clientes Ativos"
          value={clientes}
          icon={<FaUsers />}
        />
      </div>

      {/* ANIVERSARIANTES */}
      <div className="p-6 mt-10 shadow-xl bg-zinc-900 rounded-2xl">
        <h2 className="flex items-center gap-2 mb-4 text-lg font-semibold">
          <FaBirthdayCake className="text-pink-400" />
          Aniversariantes da Semana
        </h2>

        {aniversariantesSemana.length === 0 && (
          <p className="text-gray-400">Nenhum aniversariante nesta semana.</p>
        )}

        <div className="space-y-3">
          {aniversariantesSemana.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between p-4 bg-black rounded-xl"
            >
              <div>
                <p className="font-bold">{u.nome}</p>
                <p className="text-sm text-gray-400">
                  {toDate(u.dataNascimento).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <button
                onClick={() => enviarCupom(u)}
                disabled={u.cupomAniversarioEnviado}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 rounded-xl disabled:opacity-40"
              >
                <FaGift /> Cupom
              </button>
            </div>
          ))}
        </div>
      </div>

      <ReviewsModeration />
    </div>
  );
}

/* ================= COMPONENT ================= */

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative p-6 shadow-xl bg-zinc-900 rounded-2xl">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <div className="absolute text-3xl text-yellow-400 top-6 right-6">
        {icon}
      </div>
    </div>
  );
}
