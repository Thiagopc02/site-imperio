'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';

/* ========= Tipos mínimos para o SDK ========= */
type PaymentBrickController = { unmount: () => void };

type PaymentBrickOptions = {
  initialization: { amount: number }; // <<< apenas amount (sem preferenceId)
  customization?: unknown;
  callbacks?: {
    onReady?: () => void;
    onSubmit?: () => Promise<void>;
    onError?: (err: unknown) => void;
  };
};

type BricksBuilder = {
  create: (
    type: 'payment',
    containerId: string,
    options: PaymentBrickOptions
  ) => Promise<PaymentBrickController | void | undefined>;
};

type MPInstance = { bricks: () => BricksBuilder };

type MPWindow = typeof window & {
  MercadoPago?: new (key: string, opts?: { locale?: string }) => MPInstance;
};
/* ============================================ */

function CheckoutBricksInner() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [mountKey, setMountKey] = useState(0); // força remontagem quando carrinho muda

  // (opcional) ler qualquer param de retorno (?status=success|failure|pending)
  const qs = useSearchParams();
  const status = qs.get('status');

  // 1) Lê o carrinho do localStorage para calcular o total
  useEffect(() => {
    try {
      const raw = localStorage.getItem('carrinho');
      const cart: Array<{ preco: number; quantidade: number }> = raw ? JSON.parse(raw) : [];
      const total = cart.reduce((acc, i) => acc + Number(i.preco || 0) * Number(i.quantidade || 0), 0);
      setAmount(Number.isFinite(total) ? Number(total.toFixed(2)) : 0);
      // re-monta o brick quando o carrinho muda
      setMountKey((k) => k + 1);
    } catch {
      setAmount(0);
    }
  }, []);

  // 2) Marca SDK como pronto se já existir no window
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as MPWindow).MercadoPago) {
      setSdkReady(true);
    }
  }, []);

  // 3) Monta o Payment Brick **sem preferenceId** (só amount)
  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;
    if (amount === null) return; // aguardando cálculo
    if (amount <= 0) {
      setError('Seu carrinho está vazio.');
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) {
      setError('Chave pública do Mercado Pago ausente (NEXT_PUBLIC_MP_PUBLIC_KEY).');
      return;
    }

    let bricksController: PaymentBrickController | undefined;

    (async () => {
      try {
        const MPClass = (window as MPWindow).MercadoPago;
        if (!MPClass) throw new Error('SDK do Mercado Pago não carregado.');

        const mp = new MPClass(publicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        const controller = await bricksBuilder.create('payment', 'payment_brick_container', {
          initialization: { amount }, // <<< apenas amount
          customization: {
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              ticket: 'all',       // boleto
              bankTransfer: 'all', // PIX
            },
          },
          callbacks: {
            onReady: () => {
              // opcional
            },
            onSubmit: async () => {
              // Aqui você pode: validar algo no backend, registrar auditoria etc.
              // O Brick completa o pagamento; depois você redireciona para /pedidos.
              try {
                // Limpa carrinho local (se desejar)
                // localStorage.removeItem('carrinho');
                // Redireciona para /pedidos
                window.location.href = '/pedidos';
              } catch (err) {
                console.error(err);
                throw err; // dispara onError
              }
            },
            onError: (err) => {
              console.error(err);
              setError('Não foi possível processar o pagamento. Tente novamente.');
            },
          },
        });

        if (controller && typeof (controller as PaymentBrickController).unmount === 'function') {
          bricksController = controller as PaymentBrickController;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(e);
        setError(msg);
      }
    })();

    return () => {
      try {
        bricksController?.unmount?.();
      } catch {
        /* noop */
      }
    };
    // mountKey força remontagem se carrinho/amount mudarem
  }, [sdkReady, amount, mountKey]);

  return (
    <>
      <Script
        id="mp-sdk"
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />

      <div className="max-w-xl px-4 py-8 mx-auto">
        <h1 className="mb-4 text-2xl font-bold">Pagamento</h1>

        {/* Informação do retorno (opcional) */}
        {status && (
          <div className="p-3 mb-4 text-sm border rounded bg-white/10 border-white/20">
            Status do retorno: <strong>{status}</strong>
          </div>
        )}

        {error && (
          <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">
            {error}
          </div>
        )}

        {amount === null ? (
          <div className="p-3 border rounded bg-white/5 border-white/10">Calculando total…</div>
        ) : amount <= 0 ? (
          <div className="p-3 border rounded bg-white/5 border-white/10">Seu carrinho está vazio.</div>
        ) : (
          <>
            <p className="mb-2 text-sm opacity-80">Total: <strong>R$ {amount.toFixed(2)}</strong></p>
            <div id="payment_brick_container" ref={containerRef} />
          </>
        )}
      </div>
    </>
  );
}

export default function CheckoutBricksPage() {
  return (
    <Suspense fallback={<div className="max-w-xl px-4 py-8 mx-auto">Carregando pagamento…</div>}>
      <CheckoutBricksInner />
    </Suspense>
  );
}
