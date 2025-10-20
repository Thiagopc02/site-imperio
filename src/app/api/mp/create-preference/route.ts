// src/app/api/mp/create-preference/route.ts
import { NextRequest, NextResponse } from "next/server";

type CurrencyId = "BRL";

type ItemInput = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: CurrencyId;
};

type Phone = { number?: string };
type Payer = { name?: string; email?: string; phone?: Phone };

type ReceiverAddress = {
  zip_code?: string;
  street_name?: string;
  city_name?: string;
};
type Shipment = { receiver_address?: ReceiverAddress };

type BackUrls = {
  success: string;
  failure: string;
  pending: string;
};

type CreatePreferenceBody = {
  items: ItemInput[];
  payer?: Payer;
  external_reference?: string;
  shipment?: Shipment;
  back_urls?: BackUrls;
};

export async function POST(req: NextRequest) {
  try {
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) {
      console.error("MP_ACCESS_TOKEN ausente nas variáveis de ambiente.");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const bodyUnknown: unknown = await req.json();
    // _narrow_ para nosso tipo esperado:
    const body = bodyUnknown as CreatePreferenceBody;

    // Validações mínimas
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Invalid items" }, { status: 400 });
    }

    const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const defaultBackUrls: BackUrls = {
      success: `${SITE}/pedidos`,
      failure: `${SITE}/checkout-bricks?status=failure`,
      pending: `${SITE}/checkout-bricks?status=pending`,
    };

    // Monta payload aceito pelo MP
    const payload = {
      items: body.items.map((i) => ({
        title: i.title,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        currency_id: (i.currency_id ?? "BRL") as CurrencyId,
      })),
      payer: body.payer,
      external_reference: body.external_reference,
      back_urls: body.back_urls ?? defaultBackUrls,
      auto_return: "approved" as const,
      // Você pode inserir outras chaves aceitas pelo MP aqui se precisar
      // (statement_descriptor, notification_url, etc.)
      shipment: body.shipment,
    };

    const MP_API = "https://api.mercadopago.com/checkout/preferences";
    const res = await fetch(MP_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      // Em server actions/route handlers não é necessário cache especial aqui
    });

    const data: unknown = await res.json();

    if (!res.ok) {
      console.error("MP create preference FAILED", res.status, data);
      return NextResponse.json({ error: "MP error", details: data }, { status: 500 });
    }

    // A resposta do MP normalmente contém id e init_point
    const parsed = data as { id?: string; init_point?: string };
    return NextResponse.json({ id: parsed.id, init_point: parsed.init_point });
  } catch (err) {
    console.error("create-preference route error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
