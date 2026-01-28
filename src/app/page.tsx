'use client';
/* eslint-disable @next/next/no-img-element */

import type React from 'react';
import { useEffect, useState } from 'react';
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

  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return s;
  if (s.startsWith('/')) return encodeURI(s);

  if (s.startsWith('produtos/') || s.startsWith('publi/') || s.startsWith('logos/')) {
    return encodeURI('/' + s);
  }
  return encodeURI('/produtos/' + s);
}

const FALLBACK_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <rect width="100%" height="100%" fill="#0b0b0b"/>
      <text x="50%" y="50%" fill="#8a8a8a" font-size="16" font-family="Arial,Helvetica"
        text-anchor="middle" dominant-baseline="middle">
        imagem indisponível
      </text>
    </svg>`
  );

/* ===================== Carrossel ===================== */
type MarqueeItem = { src: string; alt?: string };
type CSSVars = React.CSSProperties & Record<'--speed' | '--card-w' | '--card-h', string>;

function MarqueePro({ items, speed = 36 }: { items: MarqueeItem[]; speed?: number }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = () => setIsMobile(window.innerWidth < 768);
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  if (isMobile) {
    const compact = items.slice(0, 12);
    return (
      <div className="w-full py-4 overflow-x-auto bg-black">
        <div className="flex gap-3 px-4">
          {compact.map((item, i) => (
            <div
              key={`${item.src}-${i}`}
              className="flex-shrink-0 p-2 border rounded-2xl border-white/10 bg-white/5"
              style={{ width: 130, height: 130 }}
            >
              <img
                src={item.src}
                alt={item.alt ?? 'Produto'}
                className="object-contain w-full h-full rounded-xl"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  if (el.src !== FALLBACK_DATA_URI) el.src = FALLBACK_DATA_URI;
                  el.style.opacity = '0.55';
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const track = [...items, ...items];
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
            >
              <div className="w-full h-full p-3 img-frame">
                <img
                  src={item.src}
                  alt={item.alt ?? 'Produto'}
                  className="w-full h-full object-contain rounded-[16px] bg-white/5"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* =============================== Página =============================== */
export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<MarqueeItem[]>([]);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'produtos'));
      const list: MarqueeItem[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as { imagem?: string; nome?: string };
        const src = normalizeImagePath(data.imagem);
        if (src) list.push({ src, alt: data.nome });
      });
      setItems(list);
    })();
  }, []);

  const handleCarrinhoClick = () => router.push(user ? '/carrinho' : '/login');
  const handleLoginClick = () => router.push('/login');

  return (
    <main className="min-h-screen overflow-x-hidden text-white bg-black">
      {/* Header */}
      <header className="flex flex-col gap-4 px-6 py-4 text-black bg-yellow-400 shadow-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between w-full md:w-auto">
          <Link href="/">
            <img src="/logo-imperio-ilimitada.png" alt="Império Bebidas" className="h-10 md:h-12" />
          </Link>
        </div>

        <div className="flex items-center justify-center w-full md:max-w-2xl">
          <span className="text-lg italic md:text-2xl">Império a um gole de você</span>
        </div>

        <nav className="flex items-center justify-center w-full gap-4 md:w-auto md:justify-end">
          <button onClick={handleLoginClick} className="flex items-center gap-2">
            <FaUser /> Entrar
          </button>
          <Link href="/contato" className="flex items-center gap-2">
            <FaPhoneAlt /> Contato
          </Link>
          <Link href="/produtos" className="flex items-center gap-2">
            <FaBoxes /> Categorias
          </Link>
          <button
            onClick={handleCarrinhoClick}
            className="p-2 text-3xl text-black bg-white rounded-full"
          >
            <FaShoppingCart />
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative w-full min-h-[70vh] bg-black">
        <img src="/banner.jpg" alt="Banner" className="absolute inset-0 object-cover w-full h-full" />
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center">
          <h1 className="text-5xl font-bold">Império Bebidas & Tabacos</h1>
          <p className="mt-4 text-xl">Qualidade e exclusividade direto para sua casa</p>

          {/* ✅ ÚNICA ALTERAÇÃO AQUI */}
          <Link
            href="/produtos-vitrine"
            className="px-10 py-4 mt-8 font-bold text-black bg-yellow-400 rounded-full"
          >
            Ver produtos
          </Link>
        </div>
      </section>

      {items.length > 0 && <MarqueePro items={items} />}

      <Footer />
    </main>
  );
}
