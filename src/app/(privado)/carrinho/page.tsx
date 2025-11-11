import Link from 'next/link';

export const metadata = {
  title: 'Império Bebidas & Tabacos',
  description: 'Vitrine de bebidas e tabacos. Retire ou receba em casa.',
};

export default function Home() {
  return (
    <main className="min-h-screen text-white bg-black">
      <section className="max-w-6xl px-6 py-16 mx-auto">
        <h1 className="text-4xl font-extrabold text-yellow-400 sm:text-5xl">
          Império Bebidas & Tabacos
        </h1>
        <p className="max-w-2xl mt-4 text-zinc-300">
          Explore os produtos, adicione ao carrinho e finalize seu pedido online.
        </p>

        <div className="flex flex-wrap gap-3 mt-6">
          <Link
            href="/produtos"
            className="px-5 py-3 font-semibold text-black bg-yellow-400 rounded hover:bg-yellow-500"
          >
            Ver produtos
          </Link>
          <Link
            href="/carrinho"
            className="px-5 py-3 font-semibold text-white border rounded border-zinc-600 hover:bg-zinc-800"
          >
            Ir para o carrinho
          </Link>
        </div>
      </section>
    </main>
  );
}
