// src/app/api/mp/create-preference/route.ts
import { NextRequest, NextResponse } from 'next/server';

const MP_API = 'https://api.mercadopago.com/checkout/preferences';

type ItemBody = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: 'BRL';
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      items: ItemBody[];
      payer: { name?: string; email?: string; phone?: { number?: string } };
      external_reference: string;              // obrigatório pra casarmos no webhook
      shipment?: {
        receiver_address: {
          zip_code: string;
          street_name: string;
          city_name: string;
        };
      };
      back_urls: { success: string; failure: string; pending: string };
    };

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (typeof window === 'undefined' ? '' : window.location.origin);

    // URL do webhook que o MP vai chamar
    const notificationUrl = `${baseUrl}/api/mp/webhook`;

    const payload = {
      items: body.items,
      payer: body.payer,
      external_reference: body.external_reference,
      back_urls: body.back_urls,
      auto_return: 'approved' as const,
      notification_url: notificationUrl,
      // metadados opcionais que usaremos no webhook (ajuda a montar o pedido)
      metadata: {
        email: body.payer?.email ?? null,
        phone: body.payer?.phone?.number ?? null,
      },
      shipments: body.shipment ? { receiver_address: body.shipment.receiver_address } : undefined,
    };

    const res = await fetch(MP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // token secreto (não público)
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('MP create-preference FAIL:', t);
      return NextResponse.json({ error: 'create-preference-failed' }, { status: 400 });
    }

    const data = await res.json();
    // Mercado Pago responde com "id" (preference id)
    return NextResponse.json({ id: data.id }, { status: 200 });
  } catch (e) {
    console.error('create-preference Error', e);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
