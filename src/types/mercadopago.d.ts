// Tipagem mínima para o SDK do Mercado Pago no window
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opts?: { locale?: string }) => {
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
              onSubmit?: (args: { selectedPaymentMethod?: unknown; formData: Record<string, unknown> }) => Promise<void>;
            };
          }
        ): Promise<{ unmount?: () => void }>;
      };
    };
  }
}
export {};
