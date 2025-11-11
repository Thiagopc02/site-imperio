'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Script from 'next/script';

type PaymentBrickController = { unmount: () => void };
type PaymentBrickOptions = {
  initialization: { amount: number };
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

function CheckoutBricksInner() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [mountKey, setMountKey] = useState(0);

  // PIX por e-mail
  const [pixEmail, setPixEmail] = useState('');
  const [sendingPix, setSendingPix] = useState(false);
  const [pixSuccessMsg, setPixSuccessMsg] = useState<string | null>(null);

  // total do carrinho
  useEffect(() => {
    try {
      const raw = localStorage.getItem('carrinho');
      const cart: Array<{ preco: number; quantidade: number }> = raw ? JSON.parse(raw) : [];
      const total = cart.reduce((acc, i) => acc + Number(i.preco || 0) * Number(i.quantidade || 0), 0);
      setAmount(Number.isFinite(total) ? Number(total.toFixed(2)) : 0);
      setMountKey((k) => k + 1);
    } catch {
      setAmount(0);
    }
  }, []);

  // SDK pronto
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as MPWindow).MercadoPago) {
      setSdkReady(true);
    }
  }, []);

  // Monta o Payment Brick para cartão/débito/boleto/pix (fluxo interno)
  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;
    if (amount === null) return;

    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) {
      setError('Chave pública do Mercado Pago ausente (NEXT_PUBLIC_MP_PUBLIC_KEY).');
      return;
    }

    let controller: PaymentBrickController | undefined;

    (async () => {
      try {
        const MPClass = (window as MPWindow).MercadoPago;
        if (!MPClass) throw new Error('SDK do Mercado Pago não carregado.');

        const mp = new MPClass(publicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        const c = await bricksBuilder.create('payment', 'payment_brick_container', {
          initialization: { amount: amount || 0 },
          customization: {
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              ticket: 'all',
              bankTransfer: 'all', // Pix
            },
          },
          callbacks: {
            onReady: () => {},
            onSubmit: async () => {
              // fluxo do próprio Brick (pós-sucesso)
              window.location.href = '/pedidos';
            },
            onError: (err) => {
              console.error(err);
              setError('Não foi possível processar o pagamento. Tente novamente.');
            },
          },
        });

        if (c && typeof (c as PaymentBrickController).unmount === 'function') {
          controller = c as PaymentBrickController;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(e);
        setError(msg);
      }
    })();

    return () => {
      try { controller?.unmount?.(); } catch {}
    };
  }, [sdkReady, amount, mountKey]);

  // Envia PIX por e-mail (não exibe QR/código na tela)
  const handleSendPixEmail = async () => {
    setError(null);
    setPixSuccessMsg(null);

    if (!amount || amount <= 0) {
      setError('Carrinho vazio.');
      return;
    }
    if (!pixEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixEmail)) {
      setError('Informe um e-mail válido para receber o PIX.');
      return;
    }

    try {
      setSendingPix(true);
      const res = await fetch('/api/mp/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, email: pixEmail, description: 'Compra na Império' }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setError(j.error || 'Falha ao gerar PIX');
        return;
      }

      // Mercado Pago envia o e-mail ao payer automaticamente.
      setPixSuccessMsg('Enviamos o QR Code e o código Pix para o seu e-mail. Verifique sua caixa de entrada.');

      // (opcional) abrir instruções do pagamento em nova aba
      if (j.ticket_url) {
        window.open(j.ticket_url as string, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      console.error(e);
      setError('Falha ao gerar/enviar PIX. Tente novamente.');
    } finally {
      setSendingPix(false);
    }
  };

  return (
    <>
      <Script
        id="mp-sdk"
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />

      <div className="max-w-3xl p-4 mx-auto space-y-4">
        {/* Brick do Mercado Pago */}
        <div className="p-4 border rounded-2xl border-white/10 bg-white/5">
          <h2 className="mb-2 text-xl font-bold">Pagamento</h2>

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

        {/* PIX por e-mail (sem exibir QR/copia-e-cola) */}
        <div className="p-4 border rounded-2xl border-white/10 bg-white/5">
          <h3 className="mb-3 font-semibold">Receber PIX por e-mail</h3>

          <label className="block mb-1 text-sm">E-mail</label>
          <input
            type="email"
            value={pixEmail}
            onChange={(e) => setPixEmail(e.target.value)}
            placeholder="exemplo@email.com"
            className="w-full p-2 mb-3 border rounded-lg bg-black/30 border-white/10"
          />

          <button
            onClick={handleSendPixEmail}
            className="w-full py-2 font-semibold text-black rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
            disabled={!amount || amount <= 0 || sendingPix}
          >
            {sendingPix ? 'Enviando…' : 'Enviar QRcode por e-mail'}
          </button>

          {pixSuccessMsg && (
            <p className="mt-3 text-sm text-emerald-300">{pixSuccessMsg}</p>
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
