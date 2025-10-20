'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export const metadata = { robots: { index: false, follow: false } };

export default function SucessoPage() {
  const qs = useSearchParams();
  const paymentId   = qs.get('payment_id');
  const status      = qs.get('status');
  const preference  = qs.get('preference_id');

  useEffect(() => {
    // se você salva o total do carrinho no localStorage, limpe aqui
    try { localStorage.removeItem('cart_total'); } catch {}
  }, []);

  return (
    <main className="max-w-xl px-4 py-10 mx-auto text-white">
      <h1 className="mb-4 text-3xl font-bold text-emerald-400">Pagamento aprovado ✅</h1>
      <p className="mb-2 text-sm text-gray-300">
        Recebemos a confirmação do Mercado Pago. Em breve você verá o pedido atualizado em <b>Pedidos</b>.
      </p>

      <div className="p-4 mt-4 border rounded bg-zinc-900 border-zinc-700">
        <p><b>payment_id:</b> {paymentId ?? '—'}</p>
        <p><b>status:</b> {status ?? '—'}</p>
        <p><b>preference_id:</b> {preference ?? '—'}</p>
      </div>

      <div className="flex gap-3 mt-6">
        <Link href="/pedidos" className="px-4 py-2 font-semibold text-black bg-yellow-400 rounded hover:bg-yellow-500">
          Ver meus pedidos
        </Link>
        <Link href="/" className="px-4 py-2 font-semibold text-white rounded bg-zinc-700 hover:bg-zinc-600">
          Voltar à loja
        </Link>
      </div>
    </main>
  );
}
