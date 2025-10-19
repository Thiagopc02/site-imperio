import { NextResponse } from "next/server";

const MP_API = "https://api.mercadopago.com";

export async function GET() {
  // alguns ambientes fazem "verificação" via GET
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN!;
    const payload = await req.json();

    // Estruturas comuns: { type: 'payment', data: { id: '123' } }
    const eventType =
      payload.type || payload.topic || payload.action || "unknown";
    const paymentId =
      payload?.data?.id || payload?.resource?.id || payload?.id;

    // Log básico (NÃO deixe isso em produção)
    console.log("[MP WEBHOOK] event:", eventType, "id:", paymentId);

    // Só buscamos detalhes se for pagamento
    if (eventType.includes("payment") && paymentId) {
      const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const payment = await res.json();
      console.log("[MP PAYMENT]", payment.status, payment.status_detail);

      // TODO: atualizar pedido no Firestore usando payment.external_reference
      // ex: set status do pedido = payment.status
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("[MP WEBHOOK ERROR]", e);
    return NextResponse.json({ ok: false }, { status: 200 }); // responde 200 para evitar reenvios em loop
  }
}
