'use client';
/* eslint-disable @next/next/no-img-element */

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { FaUser, FaPhoneAlt, FaBoxes, FaShoppingCart } from 'react-icons/fa';
import { GiCastle } from 'react-icons/gi';
import Footer from '@/components/Footer';

/* ===================== Normalizador de caminhos ===================== */
/** Padrão: /public/produtos */
function normalizeImagePath(p?: string): string | null {
  if (!p) return null;
  const s = p.trim();

  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return s; // URL externa / data URI
  if (s.startsWith('/')) return encodeURI(s); // já começa com /

  if (s.startsWith('produtos/') || s.startsWith('publi/') || s.startsWith('logos/')) {
    return encodeURI('/' + s);
  }
  return encodeURI('/produtos/' + s); // só nome do arquivo
}

// Placeholder inline
const FALLBACK_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <rect width="100%" height="100%" fill="#0b0b0b"/>
      <text x="50%" y="50%" fill="#8a8a8a" font-size="16" font-family="Arial,Helvetica" text-anchor="middle" dominant-baseline="middle">
        imagem indisponível
      </text>
    </svg>`
  );

/* ===================== Carrossel ===================== */
type MarqueeItem = { src: string; alt?: string };

// Tipagem para CSS custom properties
type CSSVars = React.CSSProperties & Record<'--speed' | '--card-w' | '--card-h', string>;

function MarqueePro({ items, speed = 36 }: { items: MarqueeItem[]; speed?: number }) {
  const track = useMemo(() => [...items, ...items], [items]);

  const styleVars: CSSVars = {
    '--speed': `${speed}s`,
    '--card-w': 'clamp(120px, 26vw, 180px)',
    '--card-h': 'clamp(120px, 26vw, 180px)',
  };

  return (
    <div className="relative w-full py-8 overflow-hidden bg-black">
      <div className="marquee-bg" />
      <div className="absolute inset-y-0 left-0 w-16 pointer-events-none md:w-20 bg-gradient-to-r from-black via-black/70 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-16 pointer-events-none md:w-20 bg-gradient-to-l from-black via-black/70 to-transparent" />

      <div className="marquee-wrap" style={styleVars}>
        <ul className="marquee-track">
          {track.map((item, i) => (
            <li
              key={`${item.src}-${i}`}
              className="fancy-card shrink-0"
              style={{ width: 'var(--card-w)', height: 'var(--card-h)' }}
              title={item.alt ?? 'Produto'}
            >
              <div className="w-full h-full p-3 float img-frame">
                <img
                  src={item.src}
                  alt={item.alt ?? 'Produto'}
                  className="w-full h-full object-contain rounded-[16px] bg-white/5"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    if (el.src !== FALLBACK_DATA_URI) el.src = FALLBACK_DATA_URI;
                    el.style.opacity = '0.55';
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* (Opcional) imagens locais extras em /public/produtos */
const LOCALS_IN_PRODUTOS: string[] = [
  // 'coca-cola-2L.jpg', 'H2OHlimoneto500ML.png'
];

/* =============================== Página =============================== */
export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<MarqueeItem[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Busca imagens do Firestore + mistura com /public/produtos
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'produtos'));
        const fromDb: MarqueeItem[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as { imagem?: string; nome?: string };
          const src = normalizeImagePath(data?.imagem);
          if (src) fromDb.push({ src, alt: data?.nome ?? 'Produto' });
        });

        const fromLocal: MarqueeItem[] = LOCALS_IN_PRODUTOS.map((name) => ({
          src: normalizeImagePath('produtos/' + name)!,
          alt: name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        }));

        const uniq = new Map<string, MarqueeItem>();
        [...fromDb, ...fromLocal].forEach((it) => uniq.set(it.src, it));

        let final = Array.from(uniq.values());
        if (final.length === 0) {
          final = [
            { src: normalizeImagePath('/produtos/Brahma-chopp-cx.jpg')!, alt: 'Brahma Chopp' },
            { src: normalizeImagePath('/produtos/royal-salute.jpg')!, alt: 'Royal Salute 21' },
            { src: normalizeImagePath('/produtos/Smirnoff-1L-uni00.jpg')!, alt: 'Smirnoff 1L' },
          ];
        }
        setItems(final);
      } catch {
        setItems([
          { src: normalizeImagePath('/produtos/Brahma-chopp-cx.jpg')!, alt: 'Brahma Chopp' },
          { src: normalizeImagePath('/produtos/royal-salute.jpg')!, alt: 'Royal Salute 21' },
          { src: normalizeImagePath('/produtos/Smirnoff-1L-uni00.jpg')!, alt: 'Smirnoff 1L' },
        ]);
      }
    })();
  }, []);

  const handleCarrinhoClick = () => router.push(user ? '/carrinho' : '/login');
  const handleLoginClick = () => router.push('/login');

  return (
    <main className="min-h-screen overflow-x-hidden text-white bg-black">
      {/* Header */}
      <header className="flex flex-col gap-4 px-6 py-4 text-black bg-yellow-400 shadow-md md:flex-row md:items-center md:justify-between">
        {/* Logo */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <Link href="/" aria-label="Página inicial">
            <img
              src="/logo-imperio-ilimitada.png"
              alt="Império Bebidas & Tabacos"
              className="w-auto h-10 md:h-12"
            />
          </Link>
        </div>

        {/* Slogan */}
        <div className="flex items-center justify-center w-full md:max-w-2xl">
          <span
            className="text-lg italic tracking-tight text-center text-black select-none md:text-2xl font-extralight"
            style={{ fontFamily: "'Segoe Script','Brush Script MT','Dancing Script',cursive" }}
            aria-label="Slogan"
            title="Império a um gole de você"
          >
            Império a um gole de você
          </span>
        </div>

        {/* Ações */}
        <nav className="flex items-center justify-center w-full gap-4 md:gap-6 md:w-auto md:justify-end">
          <button
            onClick={handleLoginClick}
            className="flex items-center gap-2 hover:underline min-h-[44px]"
            title="Entrar"
          >
            <FaUser /> Entrar
          </button>
          <Link href="/contato" className="flex items-center gap-2 hover:underline min-h-[44px]">
            <FaPhoneAlt /> Contato
          </Link>
          <Link href="/produtos" className="flex items-center gap-2 hover:underline min-h-[44px]">
            <FaBoxes /> Categorias
          </Link>
          <button
            onClick={handleCarrinhoClick}
            className="p-2 text-3xl text-black transition bg-white rounded-full drop-shadow-lg hover:scale-110 hover:text-yellow-600 min-h-[44px] min-w-[44px]"
            title="Carrinho"
          >
            <FaShoppingCart />
          </button>
        </nav>
      </header>

      {/* Botão flutuante → HISTÓRIA */}
      <div
        className="castle-fab animate-bounce"
        title="História das marcas"
        aria-label="História das marcas"
      >
        <Link href="/historia" className="grid w-full h-full place-items-center">
          <GiCastle className="w-10 h-10 drop-shadow-[0_0_8px_rgba(0,0,0,.45)]" />
        </Link>
      </div>

      {/* Hero / Capa */}
      <section className="relative w-full min-h-[60vh] md:min-h-[70vh] lg:h-[80vh] bg-black overflow-hidden">
        {/* Imagem de fundo */}
        <div className="absolute inset-0">
          <img
            src="/banner.jpg"
            alt="Banner Império Bebidas"
            className="w-full h-full object-cover object-[center_30%] md:object-[center_15%]"
            loading="eager"
            decoding="async"
          />
        </div>

        {/* Gradiente para melhorar leitura do texto */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/20 md:bg-gradient-to-r md:from-black/85 md:via-black/50 md:to-black/10" />

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col items-center justify-center max-w-3xl px-4 py-16 mx-auto text-center md:px-6 md:py-0">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
            Império Bebidas & Tabacos
          </h1>
          <p className="mt-4 text-base sm:text-lg md:text-xl text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
            Qualidade e exclusividade direto para sua casa
          </p>

          <Link
            href="/produtos"
            className="inline-block mt-6 md:mt-8 px-7 md:px-10 py-3.5 md:py-4 rounded-full font-bold text-black text-base md:text-lg bg-yellow-400 ring-4 ring-yellow-300/70 shadow-[0_12px_30px_rgba(0,0,0,0.45)] hover:bg-yellow-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.55)] focus:outline-none focus:ring-4 focus:ring-white/70 active:translate-y-[1px] transition-all duration-200"
            aria-label="Ver produtos"
          >
            Ver produtos
          </Link>
        </div>
      </section>

      {/* Carrossel 1 */}
      {items.length > 0 && <MarqueePro items={items} speed={34} />}

      {/* Destaques da Semana */}
      <section className="px-4 text-white bg-black py-14 md:py-16">
        <h2 className="mb-8 text-3xl font-bold text-center md:mb-10 md:text-4xl">
          Destaques da Semana
        </h2>

        <div className="grid max-w-6xl grid-cols-1 gap-6 mx-auto md:gap-8 sm:grid-cols-2 md:grid-cols-3">
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
              <img
                src={produto.img}
                alt={produto.nome}
                className="object-contain w-full bg-white h-60"
                loading="lazy"
                decoding="async"
              />
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

      {/* Carrossel 2 */}
      {items.length > 0 && <MarqueePro items={items} speed={40} />}

      {/* Rodapé */}
      <Footer />
    </main>
  );
}
