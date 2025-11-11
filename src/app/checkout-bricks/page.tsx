'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Image from 'next/image';

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

  // PIX manual (QR + Copia e Cola)
  const [pixEmail, setPixEmail] = useState('');
  const [pixId, setPixId] = useState<number | null>(null);
  const [pixQrBase64, setPixQrBase64] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixStatus, setPixStatus] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

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

  // monta o Payment Brick
  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;
    if (amount === null) return;
    if (amount <= 0) {
      setError('Seu carrinho está vazio.');
      return;
    }

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
          initialization: { amount },
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

  // Gera PIX (QR + Copia e Cola)
  const handleCreatePix = async () => {
    setError(null);
    setPixId(null);
    setPixQrBase64(null);
    setPixCode(null);
    setPixStatus(null);
    setPolling(false);

    if (!amount || amount <= 0) {
      setError('Carrinho vazio.');
      return;
    }
    if (!pixEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixEmail)) {
      setError('Informe um e-mail válido para gerar o PIX.');
      return;
    }

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

    setPixId(j.id || null);
    setPixQrBase64(j.qr_code_base64 || null);
    setPixCode(j.qr_code || null);
    setPixStatus(j.status || 'pending');
    setPolling(true);
  };

  // polling de status
  useEffect(() => {
    if (!polling || !pixId) return;
    const it = setInterval(async () => {
      try {
        const r = await fetch(`/api/mp/payment-status?id=${pixId}`);
        const j = await r.json();
        if (j?.status) setPixStatus(j.status);

        if (j?.status === 'approved') {
          clearInterval(it);
          setPolling(false);
          // localStorage.removeItem('carrinho');
          window.location.href = '/pedidos';
        }
      } catch (e) {
        console.error(e);
      }
    }, 5000);
    return () => clearInterval(it);
  }, [polling, pixId]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Código PIX copiado!');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      alert('Código PIX copiado!');
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

        {/* PIX manual imediatamente abaixo do Brick */}
        <div className="p-4 border rounded-2xl border-white/10 bg-white/5">
          <h3 className="mb-3 font-semibold">Pix (QR + Copia e Cola)</h3>

          <label className="block mb-1 text-sm">E-mail para receber o comprovante</label>
          <input
            type="email"
            value={pixEmail}
            onChange={(e) => setPixEmail(e.target.value)}
            placeholder="exemplo@email.com"
            className="w-full p-2 mb-3 border rounded-lg bg-black/30 border-white/10"
          />

          <button
            onClick={handleCreatePix}
            className="w-full py-2 font-semibold text-black rounded-lg bg-emerald-500 hover:bg-emerald-600"
            disabled={!amount || amount <= 0}
          >
            Gerar QRcode
          </button>

          {(pixQrBase64 || pixCode) && (
            <div className="mt-4 space-y-3">
              {pixQrBase64 && (
                <div className="flex flex-col items-center">
                  <Image
                    src={`data:image/png;base64,${pixQrBase64}`}
                    alt="QR Code PIX"
                    width={192}
                    height={192}
                    sizes="192px"
                    className="object-contain w-48 h-48 bg-white rounded"
                  />
                  <span className="mt-1 text-xs opacity-70">Escaneie no app do seu banco</span>
                </div>
              )}

              {pixCode && (
                <div>
                  <label className="text-sm">Copia e Cola</label>
                  <textarea
                    readOnly
                    className="w-full p-2 text-xs border rounded bg-black/30 border-white/10"
                    rows={4}
                    value={pixCode}
                  />
                  <button
                    onClick={() => copyToClipboard(pixCode)}
                    className="px-3 py-1 mt-2 font-semibold text-black bg-yellow-400 rounded"
                  >
                    Copiar código
                  </button>
                </div>
              )}

              <div className="text-sm opacity-80">
                Status: <strong>{pixStatus || '—'}</strong>
                {polling && <span className="opacity-60"> • aguardando confirmação…</span>}
              </div>
            </div>
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
