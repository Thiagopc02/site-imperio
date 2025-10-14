'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Produto = {
  id: string;
  nome: string;
  preco: number;
  imagem: string;
  quantidade: number;
  /** 'unidade' | 'caixa' | etc. */
  tipo?: string;
};

export interface CartContextType {
  /** Itens do carrinho */
  carrinho: Produto[];
  /** Alias usado pela página de produtos */
  items: Produto[];

  /** Adiciona (soma se já existir mesmo id+tipo) */
  adicionarAoCarrinho: (produto: Produto) => void;

  /** Remove item. Se 'tipo' for passado, remove somente o par id+tipo */
  removerDoCarrinho: (id: string, tipo?: string) => void;

  /** Diminui 1 do item. Compatível com versão antiga (sem tipo) */
  diminuirQuantidade: (id: string, tipo?: string) => void;

  /** Define a quantidade exata (<=0 remove) */
  atualizarQuantidade: (id: string, tipo: string | undefined, qtd: number) => void;

  /** Limpa tudo */
  limparCarrinho: () => void;

  /** Quantidade total de unidades (somatório) */
  quantidadeTotal: number;

  /** Subtotal em R$ */
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [carrinho, setCarrinho] = useState<Produto[]>([]);

  // Carregar do localStorage na inicialização
  useEffect(() => {
    const stored = localStorage.getItem('carrinho');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Produto[];
        // sanity check básicos
        setCarrinho(
          Array.isArray(parsed)
            ? parsed.map((p) => ({
                ...p,
                quantidade: Math.max(1, Number(p.quantidade) || 1),
                preco: Number(p.preco) || 0,
              }))
            : []
        );
      } catch (e) {
        console.error('Erro ao carregar carrinho:', e);
      }
    }
  }, []);

  // Salvar no localStorage sempre que o carrinho mudar
  useEffect(() => {
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
  }, [carrinho]);

  const chave = (item: Pick<Produto, 'id' | 'tipo'>) => `${item.id}__${item.tipo ?? ''}`;

  const adicionarAoCarrinho = (produto: Produto) => {
    const quantidadeValida = produto.quantidade > 0 ? produto.quantidade : 1;

    setCarrinho((prev) => {
      const map = new Map<string, Produto>();
      prev.forEach((it) => map.set(chave(it), it));

      const key = chave(produto);
      const existente = map.get(key);

      if (existente) {
        map.set(key, {
          ...existente,
          quantidade: existente.quantidade + quantidadeValida,
          // mantém o último preço/infos
          preco: produto.preco ?? existente.preco,
          nome: produto.nome ?? existente.nome,
          imagem: produto.imagem ?? existente.imagem,
        });
      } else {
        map.set(key, { ...produto, quantidade: quantidadeValida });
      }

      return Array.from(map.values());
    });
  };

  const atualizarQuantidade = (id: string, tipo: string | undefined, qtd: number) => {
    setCarrinho((prev) =>
      prev
        .map((it) =>
          it.id === id && (tipo === undefined ? true : it.tipo === tipo)
            ? { ...it, quantidade: Math.max(0, Math.trunc(qtd) || 0) }
            : it
        )
        .filter((it) => it.quantidade > 0)
    );
  };

  // Compatível com versão antiga: se não passar 'tipo', afeta todos com o id
  const diminuirQuantidade = (id: string, tipo?: string) => {
    setCarrinho((prev) =>
      prev
        .map((it) =>
          it.id === id && (tipo === undefined ? true : it.tipo === tipo)
            ? { ...it, quantidade: it.quantidade - 1 }
            : it
        )
        .filter((it) => it.quantidade > 0)
    );
  };

  const removerDoCarrinho = (id: string, tipo?: string) => {
    setCarrinho((prev) =>
      prev.filter((it) => !(it.id === id && (tipo === undefined ? true : it.tipo === tipo)))
    );
  };

  const limparCarrinho = () => setCarrinho([]);

  const quantidadeTotal = carrinho.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);
  const subtotal = carrinho.reduce(
    (acc, it) => acc + (Number(it.preco) || 0) * (Number(it.quantidade) || 0),
    0
  );

  return (
    <CartContext.Provider
      value={{
        carrinho,
        items: carrinho, // alias para a página
        adicionarAoCarrinho,
        removerDoCarrinho,
        diminuirQuantidade,
        atualizarQuantidade,
        limparCarrinho,
        quantidadeTotal,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
