'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  doc,
  serverTimestamp,
  limit,
  Timestamp,
  FirestoreError,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { FaCheck, FaTimes, FaComments } from 'react-icons/fa';

type Review = {
  id: string;
  uid?: string | null;
  nome: string;
  rating: number;
  comentario: string;
  criadoEm?: Timestamp;
  status: 'pendente' | 'aprovado' | 'reprovado';
  origem?: 'guest' | 'user';
};

function getErrMessage(e: unknown): string {
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && e !== null) {
    const r = e as Record<string, unknown>;
    if (typeof r.message === 'string') return r.message;
  }
  return 'Ocorreu um erro.';
}

function parseReviewDoc(id: string, raw: unknown): Review {
  const r = (typeof raw === 'object' && raw !== null
    ? (raw as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const statusRaw = typeof r.status === 'string' ? r.status : 'pendente';
  const status: Review['status'] =
    statusRaw === 'aprovado' || statusRaw === 'reprovado' ? (statusRaw as Review['status']) : 'pendente';

  const origem: Review['origem'] = r.origem === 'user' ? 'user' : 'guest';

  return {
    id,
    uid: typeof r.uid === 'string' ? r.uid : null,
    nome: typeof r.nome === 'string' ? r.nome : '',
    rating: typeof r.rating === 'number' ? r.rating : Number(r.rating ?? 0),
    comentario: typeof r.comentario === 'string' ? r.comentario : '',
    criadoEm: (r.criadoEm as Timestamp | undefined),
    status,
    origem,
  };
}

export default function ReviewsModeration() {
  const [pendentes, setPendentes] = useState<Review[]>([]);
  const [aprovadasRecentes, setAprovadasRecentes] = useState<Review[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Pendentes (tempo real)
  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('status', '==', 'pendente'),
      orderBy('criadoEm', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Review[] = [];
        snap.forEach((d) => list.push(parseReviewDoc(d.id, d.data())));
        setPendentes(list);
      },
      (e: FirestoreError) => setErro(e.message || 'Falha ao ler pendentes.')
    );
    return unsub;
  }, []);

  // Aprovadas recentes (só para referência visual)
  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('status', '==', 'aprovado'),
      orderBy('criadoEm', 'desc'),
      limit(6)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Review[] = [];
        snap.forEach((d) => list.push(parseReviewDoc(d.id, d.data())));
        setAprovadasRecentes(list);
      },
      () => {
        /* silencioso */
      }
    );
    return unsub;
  }, []);

  async function aprovar(id: string) {
    try {
      setBusyId(id);
      await updateDoc(doc(db, 'reviews', id), {
        status: 'aprovado',
        moderadoEm: serverTimestamp(),
      });
    } catch (e: unknown) {
      setErro(getErrMessage(e) || 'Não foi possível aprovar.');
    } finally {
      setBusyId(null);
    }
  }

  async function reprovar(id: string) {
    try {
      setBusyId(id);
      await updateDoc(doc(db, 'reviews', id), {
        status: 'reprovado',
        moderadoEm: serverTimestamp(),
      });
    } catch (e: unknown) {
      setErro(getErrMessage(e) || 'Não foi possível reprovar.');
    } finally {
      setBusyId(null);
    }
  }

  const totalPendentes = useMemo(() => pendentes.length, [pendentes]);

  return (
    <div className="p-6 mt-6 shadow bg-zinc-900 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <FaComments className="text-yellow-400" />
          Moderação de avaliações
        </h2>
        <span className="text-sm text-gray-300">
          Pendentes: <b>{totalPendentes}</b>
        </span>
      </div>

      {erro && (
        <div className="p-3 mb-4 text-sm text-red-200 border border-red-700 rounded bg-red-800/40">
          {erro}
        </div>
      )}

      {/* Lista de pendentes */}
      {pendentes.length === 0 ? (
        <p className="text-zinc-400">Nenhuma avaliação pendente no momento.</p>
      ) : (
        <ul className="space-y-3">
          {pendentes.map((r) => (
            <li key={r.id} className="p-4 border bg-black/30 border-zinc-800 rounded-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white truncate">{r.nome}</span>
                    <span className="text-xs text-zinc-400">
                      • {r.origem === 'user' ? 'logado' : 'visitante'}
                    </span>
                  </div>
                  <div className="text-yellow-400 text-sm mt-0.5">
                    {'★'.repeat(Math.max(1, Math.min(5, Math.round(r.rating || 0))))}
                  </div>
                  <p className="mt-2 break-words whitespace-pre-wrap text-zinc-200">
                    {r.comentario}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => aprovar(r.id)}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-black bg-green-400 rounded hover:bg-green-500 disabled:opacity-60"
                    title="Aprovar"
                  >
                    <FaCheck />
                    Aprovar
                  </button>
                  <button
                    onClick={() => reprovar(r.id)}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-60"
                    title="Reprovar"
                  >
                    <FaTimes />
                    Reprovar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Aprovadas recentes (somente visual) */}
      {aprovadasRecentes.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-zinc-300">
            Aprovadas recentemente
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {aprovadasRecentes.map((r) => (
              <div key={r.id} className="p-3 border rounded-lg bg-black/30 border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{r.nome}</span>
                  <span className="text-sm text-yellow-400">
                    {'★'.repeat(Math.max(1, Math.min(5, Math.round(r.rating || 0))))}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-300 line-clamp-3">{r.comentario}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
