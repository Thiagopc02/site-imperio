import { NextResponse } from "next/server";

const MP_API = "https://api.mercadopago.com";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Exemplo de fallback se o frontend não enviar itens ainda:
    const {
      orderId = `test-${Date.now()}`,
      items = [
        {
          title: "Carrinho Império",
          quantity: 1,
          unit_price: 1.99, // valor simbólico para sandbox
          currency_id: process.env.MP_CURRENCY || "BRL",
        },
      ],
      payer = {
        email: "test_user_123456@testuser.com", // email de teste no sandbox
      },
    } = body || {};

    const accessToken = process.env.MP_ACCESS_TOKEN!;
    const siteURL = process.env.NEXT_PUBLIC_SITE_URL!;
    const statementDescriptor =
      process.env.MP_STATEMENT_DESCRIPTOR || "IMPERIO";

    // URL do webhook (precisa ser pública)
    const notification_url = `${siteURL}/api/mp/webhook`;

    const preferencePayload = {
      items,
      payer,
      external_reference: String(orderId),
      notification_url,
      statement_descriptor: statementDescriptor,
      back_urls: {
        success: `${siteURL}/pedido/${orderId}?status=approved`,
        failure: `${siteURL}/pedido/${orderId}?status=failure`,
        pending: `${siteURL}/pedido/${orderId}?status=pending`,
      },
      auto_return: "approved",
      binary_mode: false, // se true, só approved/declined (sem pending)
    };

    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
      // idempotency opcional:
      // headers: { 'X-Idempotency-Key': orderId, ... }
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("MP create preference error:", err);
      return NextResponse.json(
        { error: "MP_CREATE_PREFERENCE_FAILED", detail: err },
        { status: 400 }
      );
    }

    const pref = await res.json();
    // pref.id é o preferenceId que o Bricks/Wallet usa
    return NextResponse.json({ id: pref.id, init_point: pref.init_point });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "UNEXPECTED_ERROR", detail: e?.message },
      { status: 500 }
    );
  }
}
