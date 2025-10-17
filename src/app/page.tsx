'use client';

import {
  FaUser,
  FaPhoneAlt,
  FaBoxes,
  FaShoppingCart,
} from 'react-icons/fa';
import { GiCastle } from 'react-icons/gi';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import Footer from '@/components/Footer';

/* =========================================================================
   Componente: MarqueePro (carrossel infinito, moderno, uniforme)
   - Cards com tamanho fixo (mesma largura/altura)
   - Gradiente nas bordas, sombra suave
   - Pausa no hover
   - Dobra os itens para loop contínuo
   - speed: segundos para completar 50% da faixa (ajuste fino)
   ========================================================================= */
type MarqueeItem = { src: string; alt?: string };

function MarqueePro({
  items,
  speed = 40,          // +baixo = mais rápido | +alto = mais lento
  cardW = 170,         // largura fixa do card
  cardH = 170,         // altura fixa do card
  topPadding = true,   // espaçamento vertical
}: {
  items: MarqueeItem[];
  speed?: number;
  cardW?: number;
  cardH?: number;
  topPadding?: boolean;
}) {
  // Duplicamos o array para transição contínua
  const track = useMemo(() => [...items, ...items], [items]);

  return (
    <div className={`relative w-full overflow-hidden bg-black ${topPadding ? 'py-6 md:py-8' : ''}`}>
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
              key={i}
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
                    // fallback visual discreto se a imagem não for encontrada
                    const el = e.currentTarget;
                    el.src = '/placeholder-product.png'; // opcional: adicione um placeholder em /public
                    el.classList.add('opacity-70');
                  }}
                />
              </div>
            </li>
          ))}
        </ul>

        {/* estilos do marquee */}
        <style jsx>{`
          .marquee-track {
            animation: marquee var(--marquee-speed) linear infinite;
          }
          .group:hover .marquee-track {
            animation-play-state: paused; /* pausa no hover */
          }
          @keyframes marquee {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ========================= Helpers / Fontes de imagens ==================== */
/** 
 * 1) Imagens do Firestore (campo `imagem`).
 * 2) Imagens locais dentro de /public/publi -> use caminho '/publi/arquivo.ext'
 *    Preencha o array abaixo com os nomes reais que você colocou na pasta.
 */
const PUBLI: string[] = [
  // EXEMPLOS — substitua pelos seus arquivos reais da pasta /public/publi
  // 'coca-zero-2l.png',
  // 'guarana-antarctica-269ml.jpg',
  // 'corona-269ml.png',
  // 'aurora-500ml.jpg',
  // 'licor-43.png',
];

/* ========================================================================== */

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<MarqueeItem[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Busca das imagens dos produtos no Firestore + mistura com /public/publi
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'produtos'));
        const fromDb: MarqueeItem[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as { imagem?: string; nome?: string };
          if (!data) return;

          // Se usar arquivos locais dentro de /public, lembre-se do "/" inicial:
          // ex.: '/produtos/Brahma-chopp-cx.jpg'  ou  '/publi/meu-arquivo.png'
          const src = data.imagem?.startsWith('/') ? data.imagem : data.imagem;
          if (src) fromDb.push({ src, alt: data.nome ?? 'Produto' });
        });

        // Concatena com as imagens locais da pasta /public/publi
        const fromLocal: MarqueeItem[] = PUBLI.map((name) => ({
          src: `/publi/${name}`,
          alt: name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        }));

        // Remove duplicatas pelo src
        const uniq = new Map<string, MarqueeItem>();
        [...fromDb, ...fromLocal].forEach((it) => {
          if (it.src) uniq.set(it.src, it);
        });

        let final = Array.from(uniq.values());

        // Fallback se nada vier (evita carrossel vazio)
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
            style={{
              fontFamily:
                "'Segoe Script','Brush Script MT','Dancing Script',cursive",
            }}
            aria-label="Slogan"
            title="Império a um gole de você"
          >
            Império a um gole de você
          </span>
        </div>

        {/* Ações */}
        <nav className="flex items-center justify-center w-full gap-6 md:w-auto md:justify-end">
          <button
            onClick={handleLoginClick}
            className="flex items-center gap-2 hover:underline"
            title="Entrar"
          >
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

      {/* Botão flutuante → HISTÓRIA (castelo maior) */}
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

      {/* ===== Carrossel 1 — entre o Hero e os Destaques ===== */}
      {items.length > 0 && (
        <MarqueePro items={items} speed={38} cardW={170} cardH={170} />
      )}

      {/* Destaques da Semana */}
      <section className="px-4 py-16 text-white bg-black">
        <h2 className="mb-10 text-3xl font-bold text-center md:text-4xl">
          Destaques da Semana
        </h2>

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
              {/* Imagem */}
              <img
                src={produto.img}
                alt={produto.nome}
                className="object-contain w-full bg-white h-60"
              />

              {/* Conteúdo */}
              <div className="p-5">
                <h3 className="product-title">{produto.nome}</h3>
                <p className="product-desc">{produto.descricao}</p>

                {/* Selo OFERTA */}
                <span className="oferta-pill">OFERTA</span>

                {/* Cartão de Preço */}
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

      {/* ===== Carrossel 2 — entre os Destaques e o Rodapé ===== */}
      {items.length > 0 && (
        <MarqueePro items={items} speed={42} cardW={170} cardH={170} />
      )}

      {/* Rodapé */}
      <Footer />
    </>
  );
}
