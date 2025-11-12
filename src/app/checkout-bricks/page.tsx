'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Script from 'next/script';

/** Tipagens enxutas do SDK v2 que realmente usamos */
type MPBrickController = { unmount?: () => void } | void;

type MPWindow = Window & {
  MercadoPago?: new (
    publicKey: string,
    opts?: { locale?: string }
  ) => {
    bricks(): {
      create(
        type: 'payment',
        containerId: string,
        opts: {
          initialization: { amount: number };
          customization?: {
            paymentMethods?: {
              creditCard?: 'all';
              debitCard?: 'all';
              ticket?: 'all';
              bankTransfer?: 'all'; // Pix
            };
            visual?: { hidePaymentButton?: boolean };
          };
          callbacks?: {
            onReady?: () => void;
            onError?: (e: unknown) => void;
            onSubmit?: (args?: unknown) => Promise<void>; // SDK passa unknown
          };
        }
      ): Promise<MPBrickController>;
    };
  };
};

function CheckoutBricksInner() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [mountKey, setMountKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // trava anti duplo-envio
  const submittingRef = useRef(false);

  // 1) Lê o total do carrinho
  useEffect(() => {
    try {
      const raw = localStorage.getItem('carrinho');
      const cart: Array<{ preco: number; quantidade: number }> = raw ? JSON.parse(raw) : [];
      const total = cart.reduce(
        (acc, i) => acc + Number(i.preco || 0) * Number(i.quantidade || 0),
        0
      );
      const n = Number.isFinite(total) ? Number(total.toFixed(2)) : 0;
      setAmount(n);
      setMountKey((k) => k + 1);
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

  // 3) Monta o Payment Brick
  useEffect(() => {
    if (!sdkReady || amount === null || !containerRef.current) return;

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

        const ctrl = await bricks.create('payment', 'payment_brick_container', {
          initialization: { amount: amount || 0 },
          customization: {
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              ticket: 'all',
              bankTransfer: 'all', // Pix
            },
            visual: { hidePaymentButton: false },
          },
          callbacks: {
            onReady: () => {},
            onError: (e) => {
              console.error('[Bricks onError]', e);
              setError('Não foi possível iniciar o pagamento. Tente novamente.');
            },
            // aceita unknown e extrai formData com cast seguro
            onSubmit: async (args?: unknown) => {
              if (submittingRef.current) return;
              submittingRef.current = true;
              setError(null);

              try {
                const formData = (args as { formData?: unknown } | undefined)?.formData ?? {};

                // 🔴 IMPORTANTE: o Bricks não envia transaction_amount.
                // Enviamos junto a quantia que foi usada na initialization.
                const payload = {
                  ...(formData as Record<string, unknown>),
                  transaction_amount: Number(amount || 0),
                  description: 'Pedido - Império Distribuidora',
                };

                // timeout para não estourar o tempo máximo do Brick
                const aborter = new AbortController();
                const t = setTimeout(() => aborter.abort(), 25_000);

                const resp = await fetch('/api/mp/process-payment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                  signal: aborter.signal,
                }).catch((err) => {
                  throw err?.name === 'AbortError'
                    ? new Error('Tempo esgotado ao enviar pagamento.')
                    : err;
                });

                clearTimeout(t);

                const json: {
                  ok?: boolean;
                  status?: number;
                  payment?: { status?: string; payment_method_id?: string };
                  error?: string;
                } = await resp.json().catch(() => ({}));

                if (!json?.ok) {
                  console.warn('[process-payment] resposta não OK', json);
                  setError(
                    json?.error ||
                      'Pagamento não pôde ser processado. Revise os dados e tente novamente.'
                  );
                  submittingRef.current = false;
                  return;
                }

                const payment = json.payment || {};
                const status = String(payment.status || '');
                const methodId = String(payment.payment_method_id || '');

                if (methodId === 'pix') {
                  alert('PIX gerado! Abra seu app do banco para concluir o pagamento.');
                } else if (status === 'approved') {
                  alert('Pagamento aprovado! Obrigado pela compra.');
                } else if (status === 'in_process' || status === 'pending') {
                  alert('Pagamento em análise/pendente. Você receberá a confirmação em instantes.');
                } else if (status === 'rejected') {
                  setError('Pagamento recusado. Tente outro método ou cartão.');
                  submittingRef.current = false;
                  return;
                }

                // sucesso
                window.location.href = '/pedidos';
              } catch (e) {
                console.error('[onSubmit error]', e);
                setError(
                  e instanceof Error ? e.message : 'Falha ao enviar o pagamento. Tente novamente.'
                );
              } finally {
                submittingRef.current = false;
              }
            },
          },
        });

        // evitar "any": convertemos o retorno para tipo conhecido
        const safeCtrl = ctrl as unknown as { unmount?: () => void } | void;
        if (safeCtrl && typeof safeCtrl.unmount === 'function') {
          unmount = safeCtrl.unmount.bind(safeCtrl);
        }
      } catch (e) {
        console.error('[mount bricks error]', e);
        setError(e instanceof Error ? e.message : String(e));
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

          {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">{error}</div>}

          {amount === null ? (
            <div className="p-3 border rounded bg-white/5 border-white/10">Calculando total…</div>
          ) : amount <= 0 ? (
            <div className="p-3 border rounded bg-white/5 border-white/10">
              Seu carrinho está vazio.
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm opacity-80">
                Total: <strong>R$ {amount.toFixed(2)}</strong>
              </p>

              {/* container que o Bricks usa */}
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
