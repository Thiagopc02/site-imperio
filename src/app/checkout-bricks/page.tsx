'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Script from 'next/script';

/** Tipos mínimos para o Brick */
type MPWindow = typeof window & {
  MercadoPago?: new (key: string, opts?: { locale?: string }) => {
    bricks(): {
      create(
        type: 'payment',
        containerId: string,
        options: {
          initialization: { amount: number };
          customization?: unknown;
          callbacks?: {
            onReady?: () => void;
            onSubmit?: () => Promise<void>;
            onError?: (err: unknown) => void;
          };
        }
      ): Promise<{ unmount?: () => void } | void>;
    };
  };
};

function CheckoutBricksInner() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [mountKey, setMountKey] = useState(0);

  // 1) Lê o total do carrinho
  useEffect(() => {
    try {
      const raw = localStorage.getItem('carrinho');
      const cart: Array<{ preco: number; quantidade: number }> = raw ? JSON.parse(raw) : [];
      const total = cart.reduce(
        (acc, i) => acc + Number(i.preco || 0) * Number(i.quantidade || 0),
        0
      );
      setAmount(Number.isFinite(total) ? Number(total.toFixed(2)) : 0);
      setMountKey((k) => k + 1); // força remontar o Brick se total mudar
    } catch {
      setAmount(0);
    }
  }, []);

  // 2) Marca SDK pronto quando o script carregar
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as MPWindow).MercadoPago) {
      setSdkReady(true);
    }
  }, []);

  // 3) Monta o Payment Brick (Cartão/Débito/Boleto/Pix)
  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;
    if (amount === null) return;

    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) {
      setError('Chave pública do Mercado Pago ausente (NEXT_PUBLIC_MP_PUBLIC_KEY).');
      return;
    }

    let unmount: (() => void) | undefined;

    (async () => {
      try {
        const MPClass = (window as MPWindow).MercadoPago;
        if (!MPClass) throw new Error('SDK do Mercado Pago não carregado.');

        const mp = new MPClass(publicKey, { locale: 'pt-BR' });
        const bricks = mp.bricks();

        const controller = await bricks.create('payment', 'payment_brick_container', {
          initialization: { amount: amount || 0 },
          customization: {
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              ticket: 'all',
              bankTransfer: 'all', // ✅ Pix dentro do Brick
            },
          },
          callbacks: {
            onReady: () => {
              // opcional
            },
            onSubmit: async () => {
              // Depois do fluxo do Brick, redireciona para pedidos
              window.location.href = '/pedidos';
            },
            onError: (err) => {
              console.error(err);
              setError('Não foi possível processar o pagamento. Tente novamente.');
            },
          },
        });

        if (controller && typeof controller.unmount === 'function') {
          unmount = controller.unmount.bind(controller);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(e);
        setError(msg);
      }
    })();

    return () => {
      try {
        unmount?.();
      } catch {
        /* noop */
      }
    };
  }, [sdkReady, amount, mountKey]);

  return (
    <>
      <Script
        id="mp-sdk"
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />

      <div className="max-w-3xl p-4 mx-auto">
        <div className="p-4 border rounded-2xl border-white/10 bg-white/5">
          <h2 className="mb-2 text-xl font-bold">Pagamento</h2>

          {error && (
            <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">
              {error}
            </div>
          )}

          {amount === null ? (
            <div className="p-3 border rounded bg-white/5 border-white/10">
              Calculando total…
            </div>
          ) : amount <= 0 ? (
            <div className="p-3 border rounded bg-white/5 border-white/10">
              Seu carrinho está vazio.
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm opacity-80">
                Total: <strong>R$ {amount.toFixed(2)}</strong>
              </p>
              <div id="payment_brick_container" ref={containerRef} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function CheckoutBricksPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl p-4 mx-auto">Carregando pagamento…</div>}>
      <CheckoutBricksInner />
    </Suspense>
  );
}
