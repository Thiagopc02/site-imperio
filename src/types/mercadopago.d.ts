// Tipos mínimos do SDK do Mercado Pago que roda no navegador (Payment Bricks)
declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      opts?: { locale?: string }
    ) => {
      bricks(): {
        create(
          type: 'payment',
          containerId: string,
          opts: {
            initialization: {
              amount: number;
              preferenceId?: string;
            };
            customization?: Record<string, unknown>;
            callbacks?: {
              onReady?: () => void;
              onError?: (err: unknown) => void;
              onSubmit?: (args?: unknown) => Promise<void>;
            };
          }
        ): Promise<{ unmount?: () => void } | void>;
      };
    };
  }
}
export {};
