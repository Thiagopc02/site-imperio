// app/api/mp/webhook/route.ts
import { NextResponse } from "next/server";

const MP_API = "https://api.mercadopago.com";

type MpWebhookPayload =
  | {
      type?: string;
      topic?: string;
      action?: string;
      id?: string;
      resource?: { id?: string };
      data?: { id?: string };
    }
  | Record<string, unknown>;

type MpPayment = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string | null;
};

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      // ainda assim respondemos 200 para evitar loop
      return NextResponse.json({ ok: false, reason: "no token" });
    }

    const payload = (await req.json()) as MpWebhookPayload;

    const eventType =
      (typeof payload.type === "string" && payload.type) ||
      (typeof payload.topic === "string" && payload.topic) ||
      (typeof payload.action === "string" && payload.action) ||
      "unknown";

    const paymentId =
      (payload?.data && typeof payload.data === "object"
        ? (payload.data as { id?: string }).id
        : undefined) ||
      (payload?.resource && typeof payload.resource === "object"
        ? (payload.resource as { id?: string }).id
        : undefined) ||
      (typeof (payload as { id?: string }).id === "string"
        ? (payload as { id?: string }).id
        : undefined);

    console.log("[MP WEBHOOK] event:", eventType, "id:", paymentId);

    if (eventType.includes("payment") && paymentId) {
      const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      if (res.ok) {
        const payment = (await res.json()) as MpPayment;
        console.log(
          "[MP PAYMENT]",
          payment.status,
          payment.status_detail,
          "extRef:",
          payment.external_reference
        );

        // TODO: Atualize o pedido no Firestore usando payment.external_reference
      } else {
        console.warn("[MP PAYMENT] fetch not ok", await res.text());
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[MP WEBHOOK ERROR]", e);
    // 200 evita reenvio em loop
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
