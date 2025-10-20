import { NextRequest, NextResponse } from 'next/server';

const MP_API = 'https://api.mercadopago.com/checkout/preferences';
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

type Currency = 'BRL';

interface Item {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: Currency;
}
interface Payer {
  name?: string;
  email?: string;
  phone?: { number?: string };
}
interface BackUrls {
  success: string;
  failure: string;
  pending: string;
}
interface ReceiverAddress {
  zip_code: string;
  street_name: string;
  city_name: string;
}
interface Shipment {
  receiver_address: ReceiverAddress;
}
interface CreatePrefBody {
  items: Item[];
  payer?: Payer;
  external_reference?: string;
  shipment?: Shipment;
  back_urls?: Partial<BackUrls>;
}

export async function POST(req: NextRequest) {
  try {
    if (!ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Missing MP_ACCESS_TOKEN' },
        { status: 500 }
      );
    }

    const body = (await req.json()) as CreatePrefBody;

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Invalid items' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
    const back_urls: BackUrls = {
      success: `${baseUrl}/pedidos`,
      failure: `${baseUrl}/checkout-bricks?status=failure`,
      pending: `${baseUrl}/checkout-bricks?status=pending`,
      ...(body.back_urls ?? {}),
    };

    const payload = {
      ...body,
      auto_return: 'approved' as const,
      back_urls,
      statement_descriptor: process.env.MP_STATEMENT_DESCRIPTOR ?? 'IMPERIO',
      notification_url:
        process.env.MP_NOTIFICATION_URL ?? undefined, // se quiser usar webhook
    };

    const res = await fetch(MP_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
      [k: string]: unknown;
    };

    if (!res.ok) {
      console.error('MP create preference FAILED', res.status, data);
      return NextResponse.json(
        { error: 'MP error', details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      init_point: data.init_point ?? data.sandbox_init_point,
    });
  } catch (err: unknown) {
    console.error('create-preference route error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
