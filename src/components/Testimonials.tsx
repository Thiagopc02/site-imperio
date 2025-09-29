'use client';

import Stars from './Stars';

type Testimonial = {
  name: string;
  rating: number; // 0-5 (aceita .5)
  comment: string;
  date?: string;
};

type Props = { items: Testimonial[] };

export default function Testimonials({ items }: Props) {
  const avg =
    items.length > 0
      ? Math.round((items.reduce((s, i) => s + i.rating, 0) / items.length) * 10) / 10
      : 0;

  // JSON-LD (SEO)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product', // ou Organization
    name: 'Império Bebidas & Tabacos',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: String(avg),
      reviewCount: String(items.length),
      bestRating: '5',
      worstRating: '1',
    },
    review: items.slice(0, 5).map((t) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: String(t.rating), bestRating: '5' },
      author: { '@type': 'Person', name: t.name },
      reviewBody: t.comment,
      datePublished: t.date || undefined,
    })),
  };

  return (
    <section className="px-4 py-12 text-white bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">O que dizem nossos clientes</h2>
            <p className="text-zinc-400">Avaliações reais que ficam visíveis no site.</p>
          </div>
          <div className="flex items-center gap-3">
            <Stars value={avg} size={20} />
            <span className="text-zinc-300">
              <strong className="text-white">{avg.toFixed(1)}</strong>/5 • {items.length} avaliações
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <div
              key={i}
              className="p-4 transition border rounded-2xl bg-zinc-900 border-zinc-800 hover:border-yellow-500/40"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{t.name}</div>
                <Stars value={t.rating} />
              </div>
              <p className="mt-2 text-zinc-300">{t.comment}</p>
              {t.date && <div className="mt-2 text-xs text-zinc-500">{t.date}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* SEO */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
