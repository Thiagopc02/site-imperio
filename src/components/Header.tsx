'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  FaUser,
  FaPhoneAlt,
  FaBoxes,
  FaShoppingCart,
  FaSearch,
} from 'react-icons/fa';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase/config';

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usuario) => {
      setUser(usuario);
    });
    // cleanup explícito chama unsubscribe() — evita no-unused-expressions
    return () => {
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleCarrinhoClick = () => {
    user ? router.push('/carrinho') : router.push('/login');
  };

  return (
    <header className="flex flex-col gap-4 px-6 py-4 text-black bg-yellow-400 shadow-md md:flex-row md:items-center md:justify-between">
      <div className="flex items-center justify-between w-full md:w-auto">
        <Link href="/" aria-label="Ir para a página inicial">
          <Image
            src="/logo-coroa.png"
            alt="Logo Império"
            width={160}
            height={48}
            priority
            className="w-auto h-10 md:h-12"
          />
        </Link>
      </div>

      <div className="relative w-full md:max-w-2xl">
        <div className="absolute text-2xl text-black transform -translate-y-1/2 left-4 top-1/2">
          <FaSearch />
        </div>
        <input
          type="text"
          placeholder="Buscar produtos..."
          className="w-full py-2 pl-12 pr-4 text-black bg-white border border-black rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-600"
          aria-label="Buscar produtos"
        />
      </div>

      <nav className="flex items-center justify-center w-full gap-6 md:w-auto md:justify-end">
        {user ? (
          <div className="flex items-center gap-2 text-sm">
            <span>Olá, {user.email}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-red-600 hover:underline"
            >
              Sair
            </button>
          </div>
        ) : (
          <Link href="/login" className="flex items-center gap-2 hover:underline">
            <FaUser /> Entrar
          </Link>
        )}

        <Link href="/contato" className="flex items-center gap-2 hover:underline">
          <FaPhoneAlt /> Contato
        </Link>

        <Link href="/categorias" className="flex items-center gap-2 hover:underline">
          <FaBoxes /> Categorias
        </Link>

        <button
          onClick={handleCarrinhoClick}
          className="p-2 text-3xl text-black transition bg-white rounded-full drop-shadow-lg hover:scale-110 hover:text-yellow-600"
          title="Carrinho"
          aria-label="Ir para o carrinho"
        >
          <FaShoppingCart />
        </button>
      </nav>
    </header>
  );
}
