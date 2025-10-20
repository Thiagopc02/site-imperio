// app/api/mp/create-preference/route.ts
import { NextResponse } from "next/server";

const MP_API = process.env.MP_API || "https://api.mercadopago.com";
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

type PreferenceItem = {
  id?: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: "BRL" | string;
};

type CreatePrefBody = {
  items: PreferenceItem[];
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

export async function POST(req: Request) {
  try {
    if (!ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "MP_ACCESS_TOKEN ausente" },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Partial<CreatePrefBody>;
    const items = Array.isArray(body.items) ? body.items : [];

    const preferencePayload = {
      items: items.map((it) => ({
        id: it.id,
        title: it.title,
        quantity: it.quantity,
        currency_id: it.currency_id || "BRL",
        unit_price: it.unit_price,
      })),
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/sucesso`,
        pending: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/pending`,
        failure: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/erro`,
      },
      auto_return: "approved",
      notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/mp/webhook`,
      external_reference: body.external_reference || `order_${Date.now()}`,
      payer: body.payer,
      shipment: body.shipment,
    };

    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferencePayload),
      cache: "no-store",
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("MP create preference error:", t);
      return NextResponse.json(
        { error: "Falha ao criar preferência" },
        { status: 500 }
      );
    }

    const json = (await res.json()) as { id: string };
    return NextResponse.json({ preferenceId: json.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
