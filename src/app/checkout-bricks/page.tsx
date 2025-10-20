'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ========= Tipos mínimos, compatíveis com o SDK ========= */
type PaymentBrickController = { unmount: () => void };

type PaymentBrickOptions = {
  initialization: { amount: number; preferenceId: string };
  customization?: unknown;
  callbacks?: {
    onReady?: () => void;
    onSubmit?: (_args: unknown) => Promise<void>; // importante: Promise<void>
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
/* ======================================================== */

function CheckoutBricksInner() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qs = useSearchParams();
  const prefIdFromQS = qs.get('pref_id');

  // Se o SDK já existir (navegação/memo), marca como pronto
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as MPWindow).MercadoPago) {
      setSdkReady(true);
    }
  }, []);

  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;

    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) {
      setError('Chave pública do Mercado Pago ausente (NEXT_PUBLIC_MP_PUBLIC_KEY).');
      return;
    }

    let bricksController: PaymentBrickController | undefined;

    (async () => {
      try {
        // 1) Garante um preferenceId (usa o da URL ou cria um básico)
        let preferenceId = prefIdFromQS ?? '';
        if (!preferenceId) {
          const prefRes = await fetch('/api/mp/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: [
                {
                  id: 'sku-1',
                  title: 'Exemplo',
                  quantity: 1,
                  unit_price: 10.0,
                  currency_id: 'BRL',
                },
              ],
            }),
          });

          if (!prefRes.ok) throw new Error('Falha ao criar preferência');

          const json: { id?: string; preferenceId?: string } = await prefRes.json();
          preferenceId = json.id ?? json.preferenceId ?? '';
          if (!preferenceId) throw new Error('Preferência criada sem ID.');

          // Atualiza a URL com o pref_id (sem recarregar)
          const url = new URL(window.location.href);
          url.searchParams.set('pref_id', preferenceId);
          window.history.replaceState({}, '', url.toString());
        }

        // 2) Monta o Payment Brick
        const MPClass = (window as MPWindow).MercadoPago;
        if (!MPClass) throw new Error('SDK do Mercado Pago não carregado.');

        const mp = new MPClass(publicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        const controller = await bricksBuilder.create(
          'payment',
          'payment_brick_container',
          {
            initialization: { amount: 10.0, preferenceId },
            customization: {
              paymentMethods: {
                creditCard: 'all',
                debitCard: 'all',
                ticket: 'all',
                bankTransfer: 'all', // PIX
              },
            },
            callbacks: {
              onReady: () => {
                // opcional
              },
              onSubmit: async (_args) => {
                // Se desejar processar no backend, faça fetch para /api/mp/process-payment
                // e lance erro em caso de falha para cair no onError.
              },
              onError: (err) => {
                console.error(err);
                setError('Erro no Payment Brick.');
              },
            },
          }
        );

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
  }, [sdkReady, prefIdFromQS]);

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
        {error && (
          <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">
            {error}
          </div>
        )}
        <div id="payment_brick_container" ref={containerRef} />
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
