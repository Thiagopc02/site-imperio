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
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
    <rect width="100%" height="100%" fill="#0b0b0b"/>
    <text x="50%" y="50%" fill="#8a8a8a" font-size="16"
      font-family="Arial,Helvetica"
      text-anchor="middle"
      dominant-baseline="middle">
      imagem indisponível
    </text>
  </svg>
`);

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
    return (
      <div className="w-full py-4 overflow-x-auto bg-black">
        <div className="flex gap-3 px-4">
          {items.slice(0, 12).map((item, i) => (
            <div
              key={`${item.src}-${i}`}
              className="flex-shrink-0 p-2 border rounded-2xl border-white/10 bg-white/5"
              style={{ width: 130, height: 130 }}
            >
              <img
                src={item.src}
                alt={item.alt ?? 'Produto'}
                className="object-contain w-full h-full rounded-xl"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.src = FALLBACK_DATA_URI;
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
      <div className="marquee-wrap" style={styleVars}>
        <ul className="marquee-track">
          {track.map((item, i) => (
            <li key={`${item.src}-${i}`} className="fancy-card shrink-0">
              <img src={item.src} alt={item.alt ?? 'Produto'} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<MarqueeItem[]>([]);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'produtos'));
      const imgs: MarqueeItem[] = [];
      snap.forEach((doc) => {
        const d = doc.data() as { imagem?: string; nome?: string };
        const src = normalizeImagePath(d.imagem);
        if (src) imgs.push({ src, alt: d.nome });
      });
      setItems(imgs.slice(0, 24));
    })();
  }, []);

  return (
    <main className="min-h-screen text-white bg-black">
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4 text-black bg-yellow-400">
        <Link href="/">
          <img src="/logo-imperio-ilimitada.png" className="h-12" />
        </Link>

        <nav className="flex gap-4">
          <button onClick={() => router.push('/login')} className="flex items-center gap-2">
            <FaUser /> Entrar
          </button>
          <Link href="/contato" className="flex items-center gap-2">
            <FaPhoneAlt /> Contato
          </Link>
          <Link href="/produtos" className="flex items-center gap-2">
            <FaBoxes /> Categorias
          </Link>
          <button
            onClick={() => router.push(user ? '/carrinho' : '/login')}
            className="text-2xl"
          >
            <FaShoppingCart />
          </button>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative flex items-center justify-center min-h-[70vh] text-center">
        <img src="/banner.jpg" className="absolute inset-0 object-cover w-full h-full" />
        <div className="relative z-10">
          <h1 className="text-5xl font-bold">Império Bebidas & Tabacos</h1>
          <p className="mt-4">Qualidade e exclusividade direto para sua casa</p>

          {/* ✅ BOTÃO AJUSTADO */}
          <Link
            href="/produtos-vitrine"
            className="inline-block px-10 py-4 mt-8 font-bold text-black bg-yellow-400 rounded-full"
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
