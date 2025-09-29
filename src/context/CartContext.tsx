'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Produto = {
  id: string;
  nome: string;
  preco: number;
  imagem: string;
  quantidade: number;
  tipo?: string;
};

export interface CartContextType {
  carrinho: Produto[];
  adicionarAoCarrinho: (produto: Produto) => void;
  removerDoCarrinho: (id: string) => void;
  diminuirQuantidade: (id: string) => void;
  limparCarrinho: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [carrinho, setCarrinho] = useState<Produto[]>([]);

  // Carregar do localStorage na inicialização
  useEffect(() => {
    const stored = localStorage.getItem('carrinho');
    if (stored) {
      try {
        setCarrinho(JSON.parse(stored));
      } catch (e) {
        console.error('Erro ao carregar carrinho:', e);
      }
    }
  }, []);

  // Salvar no localStorage sempre que o carrinho mudar
  useEffect(() => {
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
  }, [carrinho]);

  const adicionarAoCarrinho = (produto: Produto) => {
    const quantidadeValida = produto.quantidade > 0 ? produto.quantidade : 1;

    setCarrinho((prev) => {
      const existente = prev.find(item =>
        item.id === produto.id && item.tipo === produto.tipo
      );
      if (existente) {
        return prev.map(item =>
          item.id === produto.id && item.tipo === produto.tipo
            ? { ...item, quantidade: item.quantidade + quantidadeValida }
            : item
        );
      } else {
        return [...prev, { ...produto, quantidade: quantidadeValida }];
      }
    });
  };

  const removerDoCarrinho = (id: string) => {
    setCarrinho(prev => prev.filter(item => item.id !== id));
  };

  const diminuirQuantidade = (id: string) => {
    setCarrinho(prev =>
      prev
        .map(item =>
          item.id === id ? { ...item, quantidade: item.quantidade - 1 } : item
        )
        .filter(item => item.quantidade > 0)
    );
  };

  const limparCarrinho = () => setCarrinho([]);

  return (
    <CartContext.Provider
      value={{
        carrinho,
        adicionarAoCarrinho,
        removerDoCarrinho,
        diminuirQuantidade,
        limparCarrinho,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
