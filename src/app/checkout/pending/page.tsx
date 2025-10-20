import Link from 'next/link';

export const metadata = { robots: { index: false, follow: false } };

type SP = {
  payment_id?: string;
  status?: string;
  preference_id?: string;
};

export default function PendingPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const { payment_id, status, preference_id } = searchParams;

  return (
    <main className="max-w-xl px-4 py-10 mx-auto text-white">
      <h1 className="mb-2 text-3xl font-bold text-yellow-400">⏳ Pagamento pendente</h1>
      <p className="mb-6 text-sm text-gray-300">
        Seu pagamento ainda está sendo processado. Você receberá a confirmação em breve.
      </p>

      <div className="p-4 mb-8 border rounded bg-zinc-900 border-yellow-700/40">
        <p><b>payment_id:</b> {payment_id ?? '—'}</p>
        <p><b>status:</b> {status ?? '—'}</p>
        <p><b>preference_id:</b> {preference_id ?? '—'}</p>
      </div>

      <div className="flex gap-3">
        <Link href="/pedidos" className="px-4 py-2 font-semibold text-black bg-yellow-400 rounded">
          Ver meus pedidos
        </Link>
        <Link href="/" className="px-4 py-2 font-semibold text-white rounded bg-zinc-700 hover:bg-zinc-600">
          Voltar à loja
        </Link>
      </div>
    </main>
  );
}
