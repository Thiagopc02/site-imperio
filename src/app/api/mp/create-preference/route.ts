import { NextRequest, NextResponse } from 'next/server';

type Item = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: 'BRL';
};

type BodyIn = {
  items: Item[];
  payer?: {
    name?: string;
    email?: string;
    phone?: { number?: string };
  };
  external_reference?: string;
  shipment?: unknown;
  back_urls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BodyIn;

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Invalid items' }, { status: 400 });
    }

    const MP_API = 'https://api.mercadopago.com/checkout/preferences';
    const ACCESS_TOKEN =
      process.env.MP_ACCESS_TOKEN ||
      process.env.MP_ACCESS_TOKEN_TEST ||
      '';

    if (!ACCESS_TOKEN) {
      console.error('MP access token ausente');
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    const payload = {
      ...body,
      auto_return: 'approved' as const,
      back_urls: body.back_urls ?? {
        success: `${process.env.NEXT_PUBLIC_SITE_URL}/pedidos`,
        failure: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout-bricks?status=failure`,
        pending: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout-bricks?status=pending`,
      },
    };

    const res = await fetch(MP_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      // garante que não entra no cache estático do next
      cache: 'no-store',
    });

    const data = (await res.json()) as { id?: string; init_point?: string };

    if (!res.ok) {
      console.error('MP create preference FAILED', res.status, data);
      return NextResponse.json({ error: 'MP error', details: data }, { status: 500 });
    }

    return NextResponse.json({ id: data.id, init_point: data.init_point });
  } catch (err) {
    console.error('create-preference route error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
