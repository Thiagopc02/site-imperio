import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'missing id' }, { status: 400 });
    }
    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'MP_ACCESS_TOKEN not set' }, { status: 500 });
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const paymentClient = new Payment(client);

    const payment = await paymentClient.get({ id: Number(id) });

    return NextResponse.json({
      id: payment?.id ?? null,
      status: payment?.status ?? null,              // approved | pending | rejected | cancelled ...
      status_detail: payment?.status_detail ?? null // pending_waiting_transfer | accredited ...
    });
  } catch (e: unknown) {
    console.error('payment-status error', e);
    return NextResponse.json({ error: 'payment-status failed' }, { status: 500 });
  }
}
