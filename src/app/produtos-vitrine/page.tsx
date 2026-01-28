'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import Image from 'next/image';
import { FaLock, FaWhatsapp, FaGift } from 'react-icons/fa';
import Footer from '@/components/Footer';
import Link from 'next/link';

type Produto = {
  id: string;
  nome: string;
  descricao: string;
  imagem: string;
};

export default function ProdutosVitrinePage() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const carregarProdutos = async () => {
      const snap = await getDocs(collection(db, 'produtos'));
      const lista: Produto[] = [];

      snap.forEach((doc) => {
        const data = doc.data() as {
          nome?: string;
          descricao?: string;
          descrição?: string;
          imagem?: string;
        };

        lista.push({
          id: doc.id,
          nome: data.nome ?? 'Produto',
          descricao: data.descricao ?? data.descrição ?? '',
          imagem: data.imagem ?? '',
        });
      });

      setProdutos(lista);
      setLoading(false);
    };

    carregarProdutos();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white bg-black">
        Carregando produtos…
      </div>
    );
  }

  return (
    <main className="min-h-screen text-white bg-black">

      {/* ================= CABEÇALHO ================= */}
      <header className="w-full px-4 py-5 text-center shadow-lg bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-2xl font-extrabold text-black md:text-3xl">
            🎉 CUPOM DE BOAS-VINDAS 🎉
          </h1>

          <div className="flex items-center gap-3 px-6 py-3 text-xl font-extrabold text-black bg-white rounded-full shadow-lg md:text-2xl">
            <FaGift />
            <span>
              <strong>5% OFF</strong> na primeira compra
            </span>
          </div>

          <p className="text-sm font-semibold text-black/80">
            Entre ou cadastre-se para ativar o desconto automaticamente
          </p>

          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 mt-2 font-bold text-white transition bg-black rounded-full hover:bg-zinc-800"
          >
            Entrar / Cadastrar
          </button>
        </div>
      </header>

      {/* ================= CONTEÚDO ================= */}
      <section className="px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-4 text-4xl font-extrabold text-center text-yellow-400">
            Nossos Produtos
          </h2>

          <p className="max-w-2xl mx-auto mb-10 text-center text-gray-300">
            Confira nossa variedade de produtos.  
            Para ver preços e comprar, é necessário entrar ou se cadastrar.
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {produtos.map((produto) => (
              <div
                key={produto.id}
                className="flex flex-col p-4 transition rounded-2xl bg-zinc-900 hover:scale-[1.02] shadow-xl"
              >
                <div className="relative mb-3 overflow-hidden rounded-xl aspect-square bg-black/30">
                  <Image
                    src={
                      produto.imagem.startsWith('http') || produto.imagem.startsWith('/')
                        ? produto.imagem
                        : `/produtos/${produto.imagem}`
                    }
                    alt={produto.nome}
                    fill
                    className="object-contain p-4"
                  />
                </div>

                <h3 className="text-lg font-bold text-yellow-400">
                  {produto.nome}
                </h3>

                <p className="mt-1 mb-4 text-sm italic text-gray-400">
                  {produto.descricao}
                </p>

                {/* BOTÃO LOGIN */}
                <button
                  onClick={() => router.push('/login')}
                  className="flex items-center justify-center gap-2 py-3 mt-auto text-sm font-bold text-black transition bg-yellow-400 rounded-lg hover:bg-yellow-500"
                >
                  <FaLock />
                  Faça login para ver preços
                </button>
              </div>
            ))}
          </div>

          {/* CTA FINAL */}
          <div className="flex flex-col items-center gap-4 mt-14">
            <button
              onClick={() => router.push('/login')}
              className="px-8 py-3 font-bold text-black bg-yellow-400 rounded-xl hover:bg-yellow-500"
            >
              Entrar / Cadastrar
            </button>

            <a
              href="https://wa.me/5562999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 font-bold text-white bg-green-600 rounded-xl hover:bg-green-700"
            >
              <FaWhatsapp />
              Falar no WhatsApp
            </a>

            <Link
              href="/"
              className="mt-2 text-sm text-gray-400 underline hover:text-gray-200"
            >
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </section>

      {/* ================= RODAPÉ ================= */}
      <Footer />
    </main>
  );
}
