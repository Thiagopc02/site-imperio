// app/checkout-bricks/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

export default function CheckoutBricksPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Marca como pronto se o SDK já estiver no window
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).MercadoPago) {
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

    // tenta ler o total do carrinho salvo no localStorage (opcional)
    const getCartAmount = () => {
      try {
        const raw = localStorage.getItem('cart_total');
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) && n > 0 ? n : 10; // fallback R$ 10,00
      } catch {
        return 10;
      }
    };

    let bricksController: any;

    (async () => {
      try {
        const amount = getCartAmount();

        // 1) Cria a preferência no nosso backend (casando com o webhook)
        const prefRes = await fetch('/api/mp/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // TODO: envie seus itens reais do carrinho aqui
          body: JSON.stringify({
            items: [
              {
                id: 'cart-total',
                title: 'Compra no site',
                quantity: 1,
                unit_price: amount,
                currency_id: 'BRL',
              },
            ],
          }),
        });

        if (!prefRes.ok) throw new Error('Falha ao criar preferência');
        const { preferenceId } = await prefRes.json();

        // 2) Instancia o MP + Bricks
        const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        // 3) Monta o Payment Brick
        const settings: any = {
          initialization: {
            amount,        // valor total
            preferenceId,  // conecta com a preferência criada
          },
          customization: {
            // habilita todos os meios (pode filtrar/ordenar depois)
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              ticket: 'all',        // boletos
              bankTransfer: 'all',  // pix
            },
          },
          callbacks: {
            onReady: () => {
              // console.log('Payment Brick pronto');
            },
            onSubmit: async ({ selectedPaymentMethod, formData }: any) => {
              // Para Payment Brick, a confirmação final ocorre via MP + webhook.
              // Aqui você poderia (opcional) enviar `formData` ao seu backend para logs.
              return;
            },
            onError: (err: unknown) => {
              console.error(err);
              setError('Erro no Payment Brick.');
            },
          },
        };

        // 4) Algumas versões do SDK mostram aviso quando usamos `preferenceId`
        // sem passar explicitamente a instância MercadoPago. Passo como 4º parâmetro:
        const extraOptions = { mercadoPago: mp };

        bricksController = await bricksBuilder.create(
          'payment',
          'payment_brick_container',
          settings,
          extraOptions
        );
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Erro ao iniciar o Checkout.');
      }
    })();

    // desmonta o brick ao sair da página
    return () => {
      try {
        if (bricksController && typeof bricksController.unmount === 'function') {
          bricksController.unmount();
        }
      } catch {}
    };
  }, [sdkReady]);

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
