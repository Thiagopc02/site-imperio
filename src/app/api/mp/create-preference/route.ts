// app/api/mp/create-preference/route.ts
import { NextResponse } from 'next/server';

const MP_API = process.env.MP_API || 'https://api.mercadopago.com';
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

// Garante uma URL absoluta mesmo em Preview/Dev
function getSiteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (env) return env;
  const vercel = process.env.VERCEL_URL; // sem protocolo
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

export async function POST(req: Request) {
  try {
    if (!ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'MP_ACCESS_TOKEN ausente' },
        { status: 500 }
      );
    }

    const siteUrl = getSiteUrl();

    // Body vindo do carrinho (ver page.tsx)
    const body = await req.json().catch(() => ({} as any));
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json(
        { error: 'Itens não enviados para a preferência' },
        { status: 400 }
      );
    }

    // Monta a preferência aceitando dados opcionais do front
    const preferencePayload = {
      items: items.map((it: any) => ({
        id: it.id,
        title: it.title,
        quantity: Number(it.quantity) || 1,
        currency_id: it.currency_id || 'BRL',
        unit_price: Number(it.unit_price) || 0,
      })),

      payer: body?.payer ?? undefined,            // { name, email, phone, ... }
      shipments: body?.shipment ? {               // cuidado: nome da propriedade na API é "shipments"
        receiver_address: body.shipment.receiver_address,
      } : undefined,

      back_urls: body?.back_urls ?? {
        success: `${siteUrl}/pedidos`,
        pending: `${siteUrl}/checkout-bricks?status=pending`,
        failure: `${siteUrl}/checkout-bricks?status=failure`,
      },

      auto_return: 'approved',
      binary_mode: true,                          // só aprova transações ‘finalizadas’
      notification_url: `${siteUrl}/api/mp/webhook`,

      external_reference:
        body?.external_reference || `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,

      // extras úteis (opcionais)
      statement_descriptor: 'IMPERIO',            // como o nome aparece na fatura (≤ 22 chars)
      metadata: body?.metadata ?? undefined,
    };

    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferencePayload),
      // evita cache de edge aqui
      cache: 'no-store',
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('MP create preference error:', t);
      return NextResponse.json(
        { error: 'Falha ao criar preferência' },
        { status: 500 }
      );
    }

    const json = await res.json();

    // A página /checkout-bricks lê "pref_id" a partir de "id"
    return NextResponse.json({
      id: json.id,
      init_point: json.init_point,                  // útil se quiser redirecionar direto
      sandbox_init_point: json.sandbox_init_point,  // idem (sandbox)
    });
  } catch (e) {
    console.error('MP create-preference exception:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// (Opcional) bloqueia outros métodos:
export function GET() {
  return NextResponse.json({ ok: true });
}
