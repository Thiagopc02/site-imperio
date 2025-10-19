// app/checkout-bricks/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

export default function CheckoutBricksPage() {
  const bricksDivRef = useRef<HTMLDivElement | null>(null);
  const [mpReady, setMpReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega o SDK e sinaliza que podemos iniciar
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).MercadoPago) {
      setMpReady(true);
    }
  }, []);

  useEffect(() => {
    if (!mpReady || !bricksDivRef.current) return;

    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) {
      setError('Chave pública do Mercado Pago ausente (NEXT_PUBLIC_MP_PUBLIC_KEY).');
      return;
    }

    let bricksController: any;

    (async () => {
      try {
        // 1) cria a preferência chamando nossa API
        const prefRes = await fetch('/api/mp/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // TODO: aqui envie os itens do carrinho real
          body: JSON.stringify({
            items: [
              { id: 'sku-1', title: 'Exemplo', quantity: 1, unit_price: 10.0, currency_id: 'BRL' },
            ],
          }),
        });

        if (!prefRes.ok) throw new Error('Falha ao criar preferência');
        const { preferenceId } = await prefRes.json();

        // 2) inicializa o MP e Bricks
        const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        // 3) monta o Payment Brick
        bricksController = await bricksBuilder.create('payment', 'payment_brick_container', {
          initialization: {
            amount: 10.0, // valor total (use o total do carrinho)
            preferenceId, // conecta com a preferência criada
          },
          customization: {
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              ticket: 'all', // boletos
              bankTransfer: 'all', // PIX
            },
          },
          callbacks: {
            onReady: () => {
              // console.log('Bricks pronto');
            },
            onSubmit: ({ selectedPaymentMethod, formData }: any) => {
              // Opcional: submeter ao seu backend para criação do pagamento
              // Com Bricks, geralmente a confirmação ocorre via preferência + webhook
              return new Promise((resolve, reject) => {
                // Apenas resolve para deixar o fluxo seguir
                resolve(true);
              });
            },
            onError: (err: any) => {
              console.error(err);
              setError('Erro no Payment Brick.');
            },
          },
        });
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Erro ao iniciar o Checkout.');
      }
    })();

    // cleanup desmonta o brick ao sair da página
    return () => {
      if (bricksController && typeof bricksController.unmount === 'function') {
        bricksController.unmount();
      }
    };
  }, [mpReady]);

  return (
    <>
      <Script
        id="mp-sdk"
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setMpReady(true)}
      />
      <div className="max-w-xl px-4 py-8 mx-auto">
        <h1 className="mb-4 text-2xl font-bold">Pagamento</h1>
        {error && (
          <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">
            {error}
          </div>
        )}
        <div id="payment_brick_container" ref={bricksDivRef} />
      </div>
    </>
  );
}
