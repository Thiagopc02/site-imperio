'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export const metadata = { robots: { index: false, follow: false } };

type SP = {
  payment_id?: string;
  status?: string;
  preference_id?: string;
};

export default function ErrorPage({ searchParams }: { searchParams: SP }) {
  const { payment_id, status, preference_id } = searchParams;

  const [statusAtual, setStatusAtual] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!payment_id) {
      setErro('ID do pagamento não encontrado.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/mp/payment-status?id=${payment_id}`);
        const data = await res.json();

        if (!data.ok) {
          setErro('Falha ao consultar status do pagamento.');
        } else {
          setStatusAtual(data.paymentStatus ?? 'desconhecido');
        }
      } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
        setErro('Erro ao conectar com o servidor.');
      } finally {
        setLoading(false);
      }
    })();
  }, [payment_id]);

  return (
    <main className="max-w-xl px-4 py-10 mx-auto text-white">
      <h1 className="mb-2 text-3xl font-bold text-red-400">❌ Falha no pagamento</h1>
      <p className="mb-6 text-sm text-gray-300">
        O pagamento não pôde ser concluído. Você pode tentar novamente ou escolher outro meio.
      </p>

      <div className="p-4 mb-8 border rounded bg-zinc-900 border-red-700/40">
        <p><b>payment_id:</b> {payment_id ?? '—'}</p>
        <p><b>status inicial:</b> {status ?? '—'}</p>
        <p>
          <b>status atualizado:</b>{' '}
          {loading
            ? 'Carregando...'
            : erro
            ? <span className="text-red-400">{erro}</span>
            : statusAtual === 'approved'
            ? <span className="text-emerald-400">Aprovado ✅</span>
            : statusAtual === 'pending'
            ? <span className="text-yellow-400">Pendente ⏳</span>
            : statusAtual === 'rejected'
            ? <span className="text-red-400">Recusado ❌</span>
            : <span className="text-gray-400">{statusAtual}</span>}
        </p>
        <p><b>preference_id:</b> {preference_id ?? '—'}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/checkout-bricks"
          className="px-4 py-2 font-semibold text-black transition bg-yellow-400 rounded hover:bg-yellow-300"
        >
          Tentar novamente
        </Link>
        <Link
          href="/"
          className="px-4 py-2 font-semibold text-white transition rounded bg-zinc-700 hover:bg-zinc-600"
        >
          Voltar à loja
        </Link>
      </div>
    </main>
  );
}
