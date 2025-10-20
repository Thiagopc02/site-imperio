'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useSearchParams, useRouter } from 'next/navigation';

export default function CheckoutBricksPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefId, setPrefId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const router = useRouter();
  const sp = useSearchParams();

  // pega pref_id e amount se vierem da rota do carrinho
  useEffect(() => {
    const p = sp.get('pref_id');
    const a = sp.get('amount');
    if (p) setPrefId(p);
    if (a) setAmount(Number(a));
  }, [sp]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.MercadoPago) {
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

    const total = amount > 0 ? amount : 10.0; // fallback

    let controller: { unmount?: () => void } | null = null;

    (async () => {
      try {
        // cria pref se não veio do carrinho
        let preferenceId = prefId;
        if (!preferenceId) {
          const prefRes = await fetch('/api/mp/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: [{ id: 'sku-demo', title: 'Pedido Império', quantity: 1, unit_price: total, currency_id: 'BRL' }],
            }),
          });
          if (!prefRes.ok) throw new Error('Falha ao criar preferência');
          const data: { preferenceId: string } = await prefRes.json();
          preferenceId = data.preferenceId;
          setPrefId(preferenceId);
        }

        // inicializa SDK
        const mp = new window.MercadoPago!(publicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        controller = await bricksBuilder.create('payment', 'payment_brick_container', {
          initialization: {
            amount: total,
            preferenceId,
          },
          customization: {
            paymentMethods: {
              creditCard: { minInstallments: 1, maxInstallments: 12 },
              debitCard: 'all',
              ticket: 'all',
              bankTransfer: 'all',
            },
            visual: {
              style: {
                theme: 'default',
                customVariables: {
                  brandPrimaryColor: '#facc15',     // amarelo Império
                  textPrimaryColor: '#111111',
                  textSecondaryColor: '#1f2937',
                  inputBackgroundColor: '#ffffff',
                  buttonBackgroundColor: '#facc15',
                  buttonTextColor: '#111111',
                },
              },
              texts: { formSubmit: 'Pagar' },
            },
          },
          callbacks: {
            onReady: () => {},
            onSubmit: async ({ formData }) => {
              // formData vem do Brick; enviamos ao backend para criar o pagamento
              const res = await fetch('/api/mp/process-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...formData,
                  transaction_amount: total,
                  description: 'Pedido Império',
                  preferenceId,
                }),
              });

              const json: {
                id?: number | string;
                status?: string;
                preference_id?: string | null;
                error?: string;
              } = await res.json();

              if (!res.ok) {
                setError(json?.error || 'Falha ao processar pagamento');
                return Promise.reject();
              }

              const qs = new URLSearchParams({
                payment_id: String(json.id ?? ''),
                status: String(json.status ?? ''),
                preference_id: String(json.preference_id ?? ''),
              }).toString();

              if (json.status === 'approved') {
                router.replace(`/checkout/sucesso?${qs}`);
              } else if (json.status === 'in_process' || json.status === 'pending') {
                router.replace(`/checkout/pending?${qs}`);
              } else {
                router.replace(`/checkout/erro?${qs}`);
              }

              return Promise.resolve();
            },
            onError: (err: unknown) => {
              console.error(err);
              setError('Erro no Payment Brick.');
            },
          },
        });
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'Erro ao iniciar o Checkout.');
      }
    })();

    return () => {
      try {
        controller?.unmount?.();
      } catch {
        /* noop */
      }
    };
  }, [sdkReady, amount, prefId, router]);

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
        {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">{error}</div>}
        <div id="payment_brick_container" ref={containerRef} />
      </div>
    </>
  );
}
