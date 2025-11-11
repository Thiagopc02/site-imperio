import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      amount,
      email,
      description,
      external_reference,
    } = (body || {}) as {
      amount: number;
      email: string;
      description?: string;
      external_reference?: string;
    };

    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'MP_ACCESS_TOKEN not set' }, { status: 500 });
    }
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'email is required for PIX' }, { status: 400 });
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const paymentClient = new Payment(client);

    const payment = await paymentClient.create({
      body: {
        transaction_amount: Number(amount),
        description: description || 'Pagamento PIX',
        payment_method_id: 'pix',
        external_reference: external_reference || `pix-${Date.now()}`,
        payer: { email },
      },
    });

    const pi = payment?.point_of_interaction?.transaction_data;
    const date_of_expiration =
      (payment as unknown as { date_of_expiration?: string }).date_of_expiration ?? null;

    return NextResponse.json({
      id: payment?.id ?? null,
      status: payment?.status ?? 'pending',
      qr_code_base64: pi?.qr_code_base64 || null, // imagem base64 do QR
      qr_code: pi?.qr_code || null,               // código Copia e Cola
      ticket_url: pi?.ticket_url || null,
      date_of_expiration,
    });
  } catch (e: unknown) {
    console.error('create-pix error', e);
    return NextResponse.json({ error: 'create-pix failed' }, { status: 500 });
  }
}
