'use client';

import { FaUser, FaPhoneAlt, FaBoxes, FaShoppingCart } from 'react-icons/fa';
import { GiCastle } from 'react-icons/gi';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import Footer from '@/components/Footer';

/* ===================== NORMALIZAÇÃO DE CAMINHOS DE IMAGENS ===================== */
/** Remove acentos, caracteres estranhos, troca espaços por hifens, força minúsculas,
 * corrige ".png1" → ".png" e garante caminho /produtos/<arquivo> quando vier só o nome.
 */
function normalizeImagePath(input?: string): string | null {
  if (!input) return null;

  // Se já é URL absoluta ou caminho absoluto (começa com "/"), apenas corrige ".png1"
  if (/^https?:\/\//i.test(input) || input.startsWith('/')) {
    return input.replace(/\.png1$/i, '.png').replace(/\.jpg1$/i, '.jpg');
  }

  // Pega só o nome do arquivo
  let name = input.split('/').pop() || input;

  // Corrige extensões digitadas com "1"
  name = name.replace(/\.png1$/i, '.png').replace(/\.jpg1$/i, '.jpg').replace(/\.jpeg1$/i, '.jpeg');

  // Remove extensão desconhecida extra "1" caso ainda exista algo assim no final
  name = name.replace(/(\.(png|jpg|jpeg|webp))\d+$/i, '$1');

  // Normaliza: sem acento, sem caracteres especiais, espaços/hífens ok, minúsculo
  name = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sem acentos
    .replace(/[^a-zA-Z0-9._ -]/g, '')                 // remove !, %, etc
    .replace(/\s+/g, '-')                              // espaços -> hifens
    .replace(/-+/g, '-')                               // hifens duplos
    .toLowerCase();

  // Se não veio extensão, por segurança tente .png
  if (!/\.(png|jpg|jpeg|webp)$/i.test(name)) {
    name = name + '.png';
  }

  // Garante caminho em /produtos
  return `/produtos/${name}`;
}

/* ========================= Carrossel (Marquee) ========================= */
type MarqueeItem = { src: string; alt?: string };

function MarqueePro({
  items,
  speed = 40,          // maior = mais lento
  cardW = 170,
  cardH = 170,
}: {
  items: MarqueeItem[];
  speed?: number;
  cardW?: number;
  cardH?: number;
}) {
  const track = useMemo(() => [...items, ...items], [items]);

  return (
    <div className="relative w-full py-6 overflow-hidden bg-black md:py-8">
      {/* fades laterais */}
      <div className="absolute inset-y-0 left-0 w-20 pointer-events-none bg-gradient-to-r from-black via-black/70 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-20 pointer-events-none bg-gradient-to-l from-black via-black/70 to-transparent" />

      <div
        className="relative group"
        style={
          {
            ['--card-w' as any]: `${cardW}px`,
            ['--card-h' as any]: `${cardH}px`,
            ['--marquee-speed' as any]: `${speed}s`,
          } as React.CSSProperties
        }
      >
        <ul className="flex items-center gap-5 marquee-track md:gap-7 will-change-transform">
          {track.map((item, i) => (
            <li
              key={`${item.src}-${i}`}
              className="
                shrink-0 rounded-2xl border border-white/8
                bg-gradient-to-b from-white/5 to-white/0
                shadow-[0_8px_26px_rgba(0,0,0,.45)]
                hover:shadow-[0_12px_36px_rgba(0,0,0,.6)]
                transition-shadow duration-200
              "
              style={{ width: `var(--card-w)`, height: `var(--card-h)` }}
              title={item.alt ?? 'Produto'}
            >
              <div className="w-full h-full p-3">
                <img
                  src={item.src}
                  alt={item.alt ?? 'Produto'}
                  className="object-contain w-full h-full rounded-xl bg-white/3"
                  loading="lazy"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.src = '/placeholder-product.png'; // opcional: crie /public/placeholder-product.png
                    el.classList.add('opacity-70');
                  }}
                />
              </div>
            </li>
          ))}
        </ul>

        <style jsx>{`
          .marquee-track { animation: marquee var(--marquee-speed) linear infinite; }
          .group:hover .marquee-track { animation-play-state: paused; }
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ========================= Lista local opcional (/public/produtos) =========================
   Se quiser, você pode listar aqui alguns nomes crus como eles estão no Firestore.
   A função normalizeImagePath vai padronizar e apontar para /produtos/<slug>.ext
*/
const LOCAL_NAMES: string[] = [
  // 'CocaColaZero2L.PNG1',
  // 'H2OH! Limoneto 500ML.png',
  // 'Heineken 6x330ml.PNG',
];

/* ======================================================================== */

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<MarqueeItem[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Busca imagens do Firestore e concatena com lista local; normaliza tudo
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'produtos'));
        const fromDb: MarqueeItem[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as { imagem?: string; nome?: string };
          const normalized = normalizeImagePath(data?.imagem);
          if (normalized) fromDb.push({ src: normalized, alt: data?.nome ?? 'Produto' });
        });

        const fromLocal: MarqueeItem[] = LOCAL_NAMES.map((raw) => {
          const normalized = normalizeImagePath(raw)!;
          return { src: normalized, alt: raw.replace(/\.[^/.]+$/, '') };
        });

        // Remove duplicatas
        const uniq = new Map<string, MarqueeItem>();
        [...fromDb, ...fromLocal].forEach((it) => {
          if (it.src) uniq.set(it.src, it);
        });

        let final = Array.from(uniq.values());

        // Fallback mínimo
        if (final.length === 0) {
          final = [
            { src: '/produtos/Brahma-chopp-cx.jpg', alt: 'Brahma Chopp' },
            { src: '/produtos/royal-salute.jpg', alt: 'Royal Salute 21' },
            { src: '/produtos/Smirnoff-1L-uni00.jpg', alt: 'Smirnoff 1L' },
          ];
        }

        setItems(final);
      } catch {
        setItems([
          { src: '/produtos/Brahma-chopp-cx.jpg', alt: 'Brahma Chopp' },
          { src: '/produtos/royal-salute.jpg', alt: 'Royal Salute 21' },
          { src: '/produtos/Smirnoff-1L-uni00.jpg', alt: 'Smirnoff 1L' },
        ]);
      }
    })();
  }, []);

  const handleCarrinhoClick = () => router.push(user ? '/carrinho' : '/login');
  const handleLoginClick = () => router.push('/login');

  return (
    <>
      {/* Header */}
      <header className="flex flex-col gap-4 px-6 py-4 text-black bg-yellow-400 shadow-md md:flex-row md:items-center md:justify-between">
        {/* Logo */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <a href="/" aria-label="Página inicial">
            <img
              src="/logo-imperio-ilimitada.png"
              alt="Império Bebidas & Tabacos"
              className="w-auto h-10 md:h-12"
            />
          </a>
        </div>

        {/* Slogan no lugar da busca */}
        <div className="flex items-center justify-center w-full md:max-w-2xl">
          <span
            className="text-xl italic tracking-tight text-center text-black select-none md:text-2xl font-extralight"
            style={{ fontFamily: "'Segoe Script','Brush Script MT','Dancing Script',cursive" }}
          >
            Império a um gole de você
          </span>
        </div>

        {/* Ações */}
        <nav className="flex items-center justify-center w-full gap-6 md:w-auto md:justify-end">
          <button onClick={handleLoginClick} className="flex items-center gap-2 hover:underline" title="Entrar">
            <FaUser /> Entrar
          </button>

          <a href="/contato" className="flex items-center gap-2 hover:underline">
            <FaPhoneAlt /> Contato
          </a>

          <a href="/produtos" className="flex items-center gap-2 hover:underline">
            <FaBoxes /> Categorias
          </a>

          <button
            onClick={handleCarrinhoClick}
            className="p-2 text-3xl text-black transition bg-white rounded-full drop-shadow-lg hover:scale-110 hover:text-yellow-600"
            title="Carrinho"
          >
            <FaShoppingCart />
          </button>
        </nav>
      </header>

      {/* Botão flutuante → HISTÓRIA */}
      <div className="castle-fab animate-bounce" title="História das marcas" aria-label="História das marcas">
        <a href="/historia" className="grid w-full h-full place-items-center">
          <GiCastle className="w-10 h-10 drop-shadow-[0_0_8px_rgba(0,0,0,.45)]" />
        </a>
      </div>

      {/* Hero */}
      <section className="relative h-[80vh] bg-black overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/banner.jpg"
            alt="Banner Império Bebidas"
            className="w-full h-full object-cover object-[center_15%] scale-[0.7]"
          />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
            Império Bebidas & Tabacos
          </h1>
          <p className="mt-4 text-lg md:text-xl text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
            Qualidade e exclusividade direto para sua casa
          </p>

          {/* BOTÃO VISÍVEL */}
          <a
            href="/produtos"
            className="
              inline-block mt-8 px-8 md:px-10 py-3.5 md:py-4
              rounded-full font-bold text-black text-base md:text-lg
              bg-yellow-400 ring-4 ring-yellow-300/70
              shadow-[0_12px_30px_rgba(0,0,0,0.45)]
              hover:bg-yellow-300 hover:-translate-y-0.5
              hover:shadow-[0_18px_40px_rgba(0,0,0,0.55)]
              focus:outline-none focus:ring-4 focus:ring-white/70
              active:translate-y-[1px]
              transition-all duration-200
            "
            aria-label="Ver produtos"
          >
            Ver produtos
          </a>
        </div>
      </section>

      {/* Carrossel 1 — entre o Hero e os Destaques */}
      {items.length > 0 && <MarqueePro items={items} speed={36} cardW={170} cardH={170} />}

      {/* Destaques da Semana */}
      <section className="px-4 py-16 text-white bg-black">
        <h2 className="mb-10 text-3xl font-bold text-center md:text-4xl">Destaques da Semana</h2>

        <div className="grid max-w-6xl grid-cols-1 gap-8 mx-auto sm:grid-cols-2 md:grid-cols-3">
          {[
            {
              nome: 'Brahma Chopp 15x269ML',
              descricao:
                'A queridinha gelada e a apenas A um clique de você com UNI. APENAS R$2,93, PEÇA JA !!!',
              preco: '44,00',
              img: '/produtos/Brahma-chopp-cx.jpg',
            },
            {
              nome: 'Royal Salute 21 Anos',
              descricao: 'Whisky Escocês Luxo',
              preco: '999,90',
              img: '/produtos/royal-salute.jpg',
            },
            {
              nome: 'VodKa SMIIRNOFF 1l',
              descricao:
                'CAMPEÃ DE VENDAS A Smirnoff se encontra em uma faixa Neutra, suave e versátil — triplamente destilada.',
              preco: '37,87',
              img: '/produtos/Smirnoff-1L-uni00.jpg',
            },
          ].map((produto, idx) => (
            <div key={idx} className="product-card">
              <img src={produto.img} alt={produto.nome} className="object-contain w-full bg-white h-60" />
              <div className="p-5">
                <h3 className="product-title">{produto.nome}</h3>
                <p className="product-desc">{produto.descricao}</p>
                <span className="oferta-pill">OFERTA</span>
                <div className="price-card">
                  <span className="price-dot" />
                  <span className="price-currency">R$</span>
                  <span className="text-4xl align-middle neon-price md:text-5xl xl:text-6xl">
                    {produto.preco}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Carrossel 2 — entre os Destaques e o Rodapé */}
      {items.length > 0 && <MarqueePro items={items} speed={40} cardW={170} cardH={170} />}

      {/* Rodapé */}
      <Footer />
    </>
  );
}
