'use client';

import {
  FaUser,
  FaPhoneAlt,
  FaBoxes,
  FaShoppingCart,
  FaSearch,
} from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase/config';
import Footer from '@/components/Footer';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const handleCarrinhoClick = () => {
    router.push(user ? '/carrinho' : '/login');
  };

  const handleLoginClick = () => router.push('/login');

  return (
    <>
      {/* Header */}
      <header className="flex flex-col gap-4 px-6 py-4 text-black bg-yellow-400 shadow-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between w-full md:w-auto">
          <a href="/" aria-label="Página inicial">
            <img
              src="/logo-imperio-ilimitada.png"
              alt="Império Bebidas & Tabacos"
              className="w-auto h-10 md:h-12"
            />
          </a>
        </div>

        {/* Busca */}
        <div className="relative w-full md:max-w-2xl">
          <div className="absolute text-2xl text-black transform -translate-y-1/2 left-4 top-1/2">
            <FaSearch />
          </div>
          <input
            type="text"
            placeholder="Buscar produtos..."
            className="w-full py-2 pl-12 pr-4 text-black bg-white border border-black rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-600"
          />
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

      {/* Botão flutuante de categorias */}
      <div className="fixed z-50 bottom-6 right-6 animate-bounce">
        <a
          href="/produtos"
          className="p-4 text-black transition bg-yellow-400 rounded-full shadow-lg hover:scale-110"
          title="Ver Categorias"
        >
          <FaBoxes size={24} />
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
          <a
            href="/produtos"
            className="inline-block px-6 py-3 mt-6 font-semibold text-black transition duration-300 bg-white rounded-full shadow-md hover:bg-gray-200"
          >
            Ver produtos
          </a>
        </div>
      </section>

      {/* ===== Destaques da Semana (somente aqui) ===== */}
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
              preco: 44.0,
              img: '/produtos/Brahma-chopp-cx.jpg',
            },
            {
              nome: 'Royal Salute 21 Anos',
              descricao: 'Whisky Escocês Luxo',
              preco: 999.9,
              img: '/produtos/royal-salute.jpg',
            },
            {
              nome: 'VodKa SMIIRNOFF 1l',
              descricao:
                'CAMPEÃ DE VENDAS  A Smirnoff se encontra em uma faixa Neutra, suave e versátil — triplamente destilada.',
              preco: 37.87,
              img: '/produtos/Smirnoff-1L-uni00.jpg',
            },
          ].map((produto, idx) => {
            const precoBRL = produto.preco.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });

            return (
              <div
                key={idx}
                className="bg-neutral-900 rounded-xl overflow-hidden shadow-xl transition hover:scale-105 hover:shadow-2xl hover:rotate-[1deg]"
              >
                <img
                  src={produto.img}
                  alt={produto.nome}
                  className="object-contain w-full bg-white h-60"
                />
                <div className="p-4">
                  <h3 className="text-xl font-semibold">{produto.nome}</h3>
                  <p className="mt-1 text-gray-400">{produto.descricao}</p>

                  {/* Preço NEON 3D */}
                  <div className="relative inline-block px-3 py-2 mt-3 rounded-xl bg-black/30 backdrop-blur-sm">
                    <span aria-hidden className="neon-price-shadow">
                      R$ {precoBRL}
                    </span>
                    <span className="neon-price">R$ {precoBRL}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rodapé */}
      <Footer />
    </>
  );
}
