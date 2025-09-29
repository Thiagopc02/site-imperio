import type { Metadata } from 'next';
import Link from 'next/link';
import { FaWhatsapp, FaQuestionCircle } from 'react-icons/fa';
import HelpChat from './HelpChat';

export const metadata: Metadata = {
  title: 'Central de Ajuda | Império Bebidas & Tabacos',
  description:
    'Tire suas dúvidas com nosso assistente e encontre respostas rápidas sobre pedidos, entregas, pagamento e políticas.',
};

export default function AjudaPage() {
  return (
    <main className="max-w-5xl px-4 py-10 mx-auto text-white">
      <header className="flex flex-col items-start justify-between gap-4 pb-6 mb-8 border-b border-zinc-800 md:flex-row md:items-center">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <FaQuestionCircle className="text-yellow-400" />
          Central de Ajuda
        </h1>

        <Link
          href="https://wa.me/5562996916206"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-black transition bg-yellow-400 rounded hover:brightness-95"
        >
          <FaWhatsapp className="text-xl" />
          Falar no WhatsApp
        </Link>
      </header>

      <section className="mb-10">
        <HelpChat />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="p-5 rounded-2xl bg-zinc-900">
          <h3 className="mb-2 text-lg font-semibold">Funcionamento</h3>
          <p className="text-zinc-300">
            Domingo a Quinta: <strong>06:30 – 00:00</strong>
            <br />
            Sexta e Sábado: <strong>06:30 – 02:00</strong>
          </p>
          <div className="mt-2 text-sm text-zinc-400">
            WhatsApp: <strong>(62) 99691-6206</strong>.
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900">
          <h3 className="mb-2 text-lg font-semibold">Pagamentos</h3>
          <p className="text-zinc-300">
            Aceitamos cartões de crédito/débito e Pix. Todas as transações são
            processadas de forma segura.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900">
          <h3 className="mb-2 text-lg font-semibold">Trocas e devoluções</h3>
          <p className="text-zinc-300">
            Teve algum problema com o pedido? Fale com a gente — resolvemos para
            você rapidamente.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900">
          <h3 className="mb-2 text-lg font-semibold">Privacidade</h3>
          <p className="text-zinc-300">
            Seus dados são tratados conforme nossa{' '}
            <Link href="/privacidade" className="text-yellow-400 hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
