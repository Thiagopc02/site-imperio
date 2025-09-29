'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase/config';
import Link from 'next/link';
import {
  ShoppingCart,
  User,
  ListOrdered,
  Menu,
  PackageSearch,
} from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState<string | null>(null);
  const [showContato, setShowContato] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        setUsuario(user.displayName || user.email);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (!usuario) return null;

  return (
    <div className="min-h-screen text-white bg-black">
      <header
        className="flex flex-col items-center justify-between px-4 py-3 text-white shadow-md md:flex-row"
        style={{
          background: 'linear-gradient(to bottom, #2d2d2d, #000000)',
        }}
      >
        {/* Esquerda: Nome do usuário e sair */}
        <div className="flex items-center gap-3">
          <Menu className="w-6 h-6" />
          <span className="font-semibold">Bem-vindo, {usuario}</span>
          <button
            onClick={handleLogout}
            className="px-4 py-1 ml-2 text-white bg-red-600 rounded hover:bg-red-700"
          >
            Sair
          </button>
        </div>

        {/* Direita: Links de navegação */}
        <nav className="relative flex items-center gap-6 mt-3 text-sm md:mt-0 md:text-base">
          <Link href="/produtos" className="flex items-center gap-1 hover:underline">
            <PackageSearch className="text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
            Produtos
          </Link>
          <Link href="/pedidos" className="flex items-center gap-1 hover:underline">
            <ListOrdered className="text-pink-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
            Pedidos
          </Link>
          <button onClick={() => setShowContato(!showContato)} className="flex items-center gap-1 hover:underline">
            <User className="text-rose-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
            Contato
          </button>
          <Link href="/categorias" className="flex items-center gap-1 hover:underline">
            <Menu className="text-yellow-200 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
            Categorias
          </Link>
          <Link href="/carrinho" className="flex items-center gap-1 hover:underline">
            <ShoppingCart className="text-slate-100 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
            Carrinho
          </Link>

          {/* Aba de Contato via WhatsApp */}
          {showContato && (
            <div
              onClick={() => window.open('https://wa.me/5562996916206', '_blank')}
              className="absolute right-0 z-10 flex items-center gap-2 p-3 mt-2 font-bold text-black bg-green-600 rounded shadow-lg cursor-pointer top-full"
              style={{
                border: '6px solid transparent',
                backgroundImage: 'linear-gradient(green, green), linear-gradient(45deg, black, gray, green)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
              }}
            >
              <img
                src="/whatsapp-icon.png"
                alt="WhatsApp"
                className="w-6 h-6"
              />
              Falar com Atendente via WhatsApp
            </div>
          )}
        </nav>
      </header>

      <main className="px-4 py-6">{children}</main>
    </div>
  );
}
