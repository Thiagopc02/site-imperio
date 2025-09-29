'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  Timestamp,
} from 'firebase/firestore';

import Stars from './Stars';
import StarInput from './StarInput';

type ReviewDoc = {
  id: string;
  uid?: string | null;
  nome: string;
  rating: number;
  comentario: string;
  criadoEm?: Timestamp;
  status: 'pendente' | 'aprovado' | 'reprovado';
  origem: 'guest' | 'user';
};

export default function ReviewsBoard() {
  const [user, setUser] = useState<User | null>(null);

  // formulário
  const [nome, setNome] = useState('');
  const [rating, setRating] = useState(5);
  const [comentario, setComentario] = useState('');
  const [salvando, setSalvando] = useState(false);

  // lista
  const [items, setItems] = useState<ReviewDoc[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u?.displayName) setNome(u.displayName);
    });
    return () => unsub();
  }, []);

  // apenas avaliações aprovadas
  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('status', '==', 'aprovado'),
      orderBy('criadoEm', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: ReviewDoc[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setItems(list);
    });
    return unsub;
  }, []);

  const media = useMemo(() => {
    if (!items.length) return 0;
    const sum = items.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return Math.round((sum / items.length) * 10) / 10;
  }, [items]);

  const nomeOk = nome.trim().length >= 2 && nome.trim().length <= 60;
  const comentarioOk = comentario.trim().length >= 10 && comentario.trim().length <= 500;
  const podeEnviar = nomeOk && comentarioOk && rating >= 1 && rating <= 5;

  async function enviar() {
    if (!podeEnviar) {
      alert('Preencha um nome válido (2–60), nota e um comentário (mín. 10, máx. 500).');
      return;
    }

    try {
      setSalvando(true);
      await addDoc(collection(db, 'reviews'), {
        uid: user ? user.uid : null,
        nome: nome.trim(),
        rating,
        comentario: comentario.trim(),
        criadoEm: serverTimestamp(),
        status: 'pendente',            // admin aprova depois
        origem: user ? 'user' : 'guest',
      });
      setComentario('');
      if (!user) setNome('');         // visitante: limpa o nome também
      setRating(5);
      alert('Obrigado! Sua avaliação foi enviada e aguarda aprovação.');
    } catch (e) {
      console.error(e);
      alert('Não foi possível enviar sua avaliação agora.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="px-4 py-10 text-white bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">O que dizem nossos clientes</h2>
            <p className="text-zinc-400">Avaliações reais; novas avaliações passam por moderação.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-300">
            <Stars value={media} readOnly />
            <span><strong className="text-white">{media.toFixed(2)}</strong>/5 • {items.length} avaliações</span>
          </div>
        </div>

        {/* Formulário público */}
        <div className="max-w-2xl p-4 mb-8 border rounded-2xl bg-zinc-900 border-zinc-800">
          {!user && (
            <p className="p-3 mb-4 text-sm border rounded bg-zinc-800 border-zinc-700 text-zinc-200">
              Você pode avaliar sem login. Se preferir publicar com seu nome de perfil,
              <a href="/login?next=/sobre-nos#avaliar" className="font-semibold text-yellow-400 underline underline-offset-2"> faça login</a>.
            </p>
          )}

          <label className="block mb-1 text-sm text-zinc-300">Seu nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={60}
            className="w-full px-3 py-2 mb-3 border rounded outline-none bg-black/40 border-zinc-700 focus:ring-2 focus:ring-yellow-500"
            placeholder="Como quer aparecer no site"
          />

          <span className="block mb-1 text-sm text-zinc-300">Sua nota</span>
          <div className="mb-3">
            <StarInput value={rating} onChange={setRating} />
          </div>

          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Conte sua experiência (mín. 10 e máx. 500 caracteres)"
            className="w-full px-3 py-2 border rounded outline-none bg-black/40 border-zinc-700 focus:ring-2 focus:ring-yellow-500"
          />
          <div className="mt-1 text-xs text-right text-zinc-500">{comentario.trim().length}/500</div>

          <button
            onClick={enviar}
            disabled={!podeEnviar || salvando}
            className="px-4 py-2 mt-3 font-semibold text-black bg-yellow-400 rounded-full hover:bg-yellow-500 disabled:opacity-60"
          >
            {salvando ? 'Enviando…' : 'Publicar avaliação'}
          </button>
        </div>

        {/* Lista de aprovadas */}
        {items.length === 0 ? (
          <p className="text-zinc-400">Ainda não há avaliações aprovadas.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map((r) => (
              <div key={r.id} className="p-4 border rounded-2xl bg-zinc-900 border-zinc-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{r.nome}</h4>
                  <Stars value={Number(r.rating) || 0} readOnly />
                </div>
                <p className="mt-2 text-zinc-300">{r.comentario}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {r.criadoEm?.toDate ? r.criadoEm.toDate().toLocaleDateString('pt-BR') : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
