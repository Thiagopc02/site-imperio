'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import { FaInstagram, FaHeadset } from 'react-icons/fa';
import Stars from '@/components/Stars';

type ReviewDoc = {
  id: string;
  uid?: string | null;
  nome: string;
  rating: number;
  comentario: string;
  criadoEm: Timestamp;
  status: 'pendente' | 'aprovado' | 'reprovado';
};

export default function SobrePage() {
  // ===== Auth (só para prefazer nome/uid quando logado) =====
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // ===== Form =====
  const [nome, setNome] = useState('');
  const [rating, setRating] = useState(5);
  const [comentario, setComentario] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Prefill do nome quando logado
  useEffect(() => {
    if (user?.displayName) setNome(user.displayName);
  }, [user]);

  const safeNome = useMemo(() => nome.trim().slice(0, 60), [nome]);
  const safeComentario = useMemo(() => comentario.trim().slice(0, 500), [comentario]);
  const canPublish =
    safeNome.length >= 2 && rating >= 1 && rating <= 5 && safeComentario.length >= 10;

  // ===== Leitura de avaliações aprovadas =====
  const [reviews, setReviews] = useState<ReviewDoc[]>([]);
  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),               // mantém sua coleção atual
      where('status', '==', 'aprovado'),
      orderBy('criadoEm', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: ReviewDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<ReviewDoc, 'id'>;
        list.push({ id: d.id, ...data });
      });
      setReviews(list);
    });
    return unsub;
  }, []);

  const media = useMemo(() => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return Math.round((sum / reviews.length) * 100) / 100;
  }, [reviews]);

  async function publicarAvaliacao() {
    if (!canPublish) {
      alert('Preencha nome, nota e um comentário (mín. 10 caracteres).');
      return;
    }
    try {
      setSalvando(true);
      await addDoc(collection(db, 'reviews'), {
        uid: user ? user.uid : null,
        nome: safeNome,
        rating,
        comentario: safeComentario,
        criadoEm: serverTimestamp(),
        status: 'pendente', // será aprovado pelo admin
        origem: user ? 'user' : 'guest',
      });
      setComentario('');
      if (!user) setNome(''); // visitante: limpamos o nome também
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
    <main className="max-w-6xl px-4 py-10 mx-auto text-white">
      {/* Hero */}
      <section className="p-6 mb-8 border rounded-2xl bg-zinc-900 border-zinc-800">
        <h1 className="text-2xl font-bold text-yellow-400 md:text-3xl">
          Sobre a Distribuidora Império
        </h1>
        <p className="mt-3 text-zinc-300">
          Somos apaixonados por oferecer uma ótima experiência de compra em bebidas e tabacos.
          Atuamos em Campos Belos–GO com um mix completo, preços justos e atendimento que resolve.
        </p>
      </section>

      {/* Blocos institucionais (mantidos) */}
      <section className="grid gap-6 mb-12 md:grid-cols-3">
        <div className="p-5 border rounded-2xl bg-zinc-900 border-zinc-800">
          <h3 className="mb-2 text-lg font-semibold">Quem somos</h3>
          <p className="text-zinc-300">
            A Império nasceu para simplificar o acesso aos melhores rótulos, marcas e acessórios.
            Selecionamos fornecedores confiáveis para que você receba produtos com procedência e
            qualidade.
          </p>
        </div>

        <div className="p-5 border rounded-2xl bg-zinc-900 border-zinc-800">
          <h3 className="mb-2 text-lg font-semibold">Missão</h3>
          <ul className="space-y-1 list-disc list-inside text-zinc-300">
            <li>Catálogo sempre atualizado</li>
            <li>Logística ágil e segura</li>
            <li>Respeito às políticas de consumo responsável</li>
          </ul>
        </div>

        <div className="p-5 border rounded-2xl bg-zinc-900 border-zinc-800">
          <h3 className="mb-2 text-lg font-semibold">Valores</h3>
          <ul className="space-y-1 list-disc list-inside text-zinc-300">
            <li>Transparência e confiança</li>
            <li>Excelência no atendimento</li>
            <li>Parcerias duradouras com clientes e fornecedores</li>
          </ul>
        </div>
      </section>

      {/* Contatos / CTA (mantidos) */}
      <section className="grid gap-6 mb-12 md:grid-cols-3">
        <div className="p-5 border rounded-2xl bg-zinc-900 border-zinc-800">
          <h3 className="mb-2 text-lg font-semibold">Onde estamos</h3>
          <p className="text-zinc-300">
            Campos Belos – GO
            <br />
            Atendimento local e região.
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            *Vendas de tabaco e bebidas alcoólicas destinadas apenas a maiores de 18 anos. Tenha um
            documento válido em mãos.
          </p>
        </div>

        <div className="p-5 border rounded-2xl bg-zinc-900 border-zinc-800">
          <h3 className="mb-2 text-lg font-semibold">Fale com a gente</h3>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://instagram.com/distribuidoraimperio3015"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-full bg-zinc-800 hover:bg-zinc-700"
            >
              <FaInstagram /> @distribuidoraimperio3015
            </a>

            <a
              href="/contato"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-full bg-zinc-800 hover:bg-zinc-700"
            >
              <FaHeadset /> Fale conosco
            </a>

            <a
              href="/ajuda"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-full bg-zinc-800 hover:bg-zinc-700"
            >
              Central de ajuda
            </a>
          </div>
        </div>

        <div className="p-5 border rounded-2xl bg-zinc-900 border-zinc-800">
          <h3 className="mb-2 text-lg font-semibold">Pronto para fazer seu pedido?</h3>
          <p className="text-zinc-300">
            Navegue pelas categorias e adicione produtos ao carrinho.
          </p>
          <a
            href="/produtos"
            className="inline-block px-4 py-2 mt-3 font-semibold text-black bg-yellow-400 rounded-full hover:bg-yellow-500"
          >
            Ver produtos
          </a>
        </div>
      </section>

      {/* Avaliações */}
      <section className="mb-6" id="avaliar">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">O que dizem nossos clientes</h2>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Stars value={media} readOnly />
            <span>{media.toFixed(2)}</span>
            <span>• {reviews.length} avaliações</span>
          </div>
        </div>

        {/* Formulário (aberto p/ todos) */}
        <div className="p-4 mb-6 border rounded-2xl bg-zinc-900 border-zinc-800">
          {!user && (
            <div className="mb-3">
              <label className="block mb-1 text-sm text-zinc-300">Seu nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={60}
                className="w-full px-3 py-2 border rounded outline-none bg-black/40 border-zinc-700 focus:ring-2 focus:ring-yellow-500"
                placeholder="Ex.: João Silva"
              />
            </div>
          )}

          <div className="mb-3">
            <span className="block mb-1 text-sm text-zinc-300">Sua nota:</span>
            {/* <-- ajuste aqui: ariaLabel -> label */}
            <Stars value={rating} onChange={setRating} label="Sua nota" />
          </div>

          <div className="mb-3">
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Escreva como foi sua experiência (máx. 500 caracteres)"
              className="w-full px-3 py-2 border rounded outline-none bg-black/40 border-zinc-700 focus:ring-2 focus:ring-yellow-500"
            />
            <div className="mt-1 text-xs text-right text-zinc-500">
              {safeComentario.length}/500
            </div>
          </div>

          <button
            onClick={publicarAvaliacao}
            disabled={!canPublish || salvando}
            className="px-4 py-2 font-semibold text-black bg-yellow-400 rounded-full hover:bg-yellow-500 disabled:opacity-60"
          >
            {salvando ? 'Enviando…' : 'Publicar avaliação'}
          </button>

          {!user && (
            <p className="mt-2 text-xs text-zinc-500">
              Dica: se preferir,{' '}
              <Link href="/login?next=/sobre-nos#avaliar" className="text-yellow-400 hover:underline">
                faça login
              </Link>{' '}
              para publicar com seu nome de perfil.
            </p>
          )}
        </div>

        {/* Lista de avaliações aprovadas */}
        {reviews.length === 0 ? (
          <p className="text-zinc-400">Ainda não há avaliações. Seja o primeiro a avaliar!</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <div key={r.id} className="p-4 border rounded-2xl bg-zinc-900 border-zinc-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{r.nome}</h4>
                  <Stars value={r.rating} readOnly />
                </div>
                <p className="mt-2 text-zinc-300">{r.comentario}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {r.criadoEm?.toDate ? r.criadoEm.toDate().toLocaleDateString('pt-BR') : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
