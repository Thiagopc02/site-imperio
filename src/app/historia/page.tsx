export const metadata = {
  title: 'História das Marcas | Império',
  description:
    'Conheça histórias, curiosidades e marcos das grandes marcas de bebidas e tabacos.',
};

export default function HistoriaPage() {
  const marcas = [
    {
      nome: 'Royal Salute',
      capa: '/produtos/royal-salute.jpg',
      resumo:
        'Lançado em 1953 para celebrar a coroação de Elizabeth II, o Royal Salute tornou-se sinônimo de luxo e maturação prolongada.',
    },
    {
      nome: 'Smirnoff',
      capa: '/produtos/Smirnoff-1L-uni00.jpg',
      resumo:
        'Criada na Rússia por Pyotr Smirnov no século XIX, popularizou a vodka em coquetéis no mundo inteiro no século XX.',
    },
    {
      nome: 'Brahma',
      capa: '/produtos/Brahma-chopp-cx.jpg',
      resumo:
        'Fundada em 1888, a Brahma difundiu o chopp no Brasil e é presença constante nos grandes eventos esportivos.',
    },
  ];

  return (
    <main className="min-h-screen text-white bg-black">
      <section className="container py-10">
        <h1 className="mb-8 text-3xl font-bold text-center md:text-4xl">
          Histórias de Grandes Marcas
        </h1>

        <p className="max-w-3xl mx-auto mb-10 text-center text-gray-300">
          Curiosidades, marcos e a trajetória de bebidas que conquistaram o
          mundo. Em breve: páginas detalhadas com linhas do tempo, fotos e
          fatos históricos de cada rótulo.
        </p>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {marcas.map((m, i) => (
            <article
              key={i}
              className="overflow-hidden transition shadow-xl bg-neutral-900 rounded-2xl hover:shadow-2xl"
            >
              <img
                src={m.capa}
                alt={m.nome}
                className="object-contain w-full h-56 bg-white"
              />
              <div className="p-5">
                <h2 className="text-xl font-semibold">{m.nome}</h2>
                <p className="mt-2 text-gray-300">{m.resumo}</p>

                <div className="mt-4">
                  <a
                    href="#"
                    className="inline-block px-4 py-2 font-semibold text-black transition bg-yellow-400 rounded hover:bg-yellow-500"
                  >
                    Ler história completa
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
