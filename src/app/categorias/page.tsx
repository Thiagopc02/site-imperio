'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { db } from '@/firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';

type Produto = {
  id: string;
  nome: string;
  preco: number;
  imagem?: string;
  quantidade?: number;
  tipo?: string;
  categoria?: string;
};

const FALLBACK_CATEGORIAS = [
  'Destilados',
  'Fermentados',
  'Adega',
  'Águas',
  'Refrescos e Sucos',
  'Gelos',
  'Balas e Gomas',
  'Chocolates',
  'Outros',
];

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<string[] | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'produtos'),
      (snap) => {
        const set = new Set<string>();
        snap.forEach((d) => {
          const data = d.data() as Produto;
          const cat = (data.categoria || '').trim();
          if (cat) set.add(cat);
        });
        const arr = Array.from(set);
        setCategorias(arr.length ? arr : FALLBACK_CATEGORIAS);
      },
      () => setCategorias(FALLBACK_CATEGORIAS)
    );
    return () => unsub();
  }, []);

  const ordered = useMemo(() => {
    if (!categorias) return [];
    return [...categorias].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [categorias]);

  return (
    <div className="max-w-6xl p-6 mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold md:text-3xl">Categorias</h1>
        <p className="mt-1 text-sm opacity-80">Selecione uma categoria para ver os produtos.</p>
      </header>

      {!categorias ? (
        <div className="grid grid-cols-2 gap-4 animate-pulse sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 border rounded-2xl bg-white/10 border-white/10" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <div className="p-6 border rounded-2xl border-white/10 bg-white/5">Nenhuma categoria encontrada.</div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {ordered.map((cat) => (
            <li key={cat}>
              <Link
                href={`/produtos?categoria=${encodeURIComponent(cat)}`}
                prefetch={false}
                className="flex items-center justify-center h-24 p-5 text-center transition border shadow rounded-2xl border-yellow-400/30 bg-white/5 hover:bg-white/10"
              >
                <span className="font-semibold">{cat}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
