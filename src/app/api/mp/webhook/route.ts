// src/app/api/mp/webhook/route.ts
import { NextResponse } from "next/server";
import { admin, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs"; // garante Node runtime (Admin SDK precisa)

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
  status?: string;         // approved | pending | rejected | cancelled | in_process | etc
  status_detail?: string;  // detalhes (pending_waiting_transfer, accredited, etc.)
  external_reference?: string | null; // aqui esperamos o ID do pedido
};

function mapMpStatusToPedidoStatus(s?: string): string {
  if (!s) return "Em andamento";
  const v = s.toLowerCase();
  if (v === "approved") return "Confirmado";
  if (v === "pending" || v === "in_process") return "Em andamento";
  if (v === "rejected" || v === "cancelled") return "Cancelado";
  return s; // fallback: mantém o texto original
}

export async function GET() {
  // útil para validação rápida do endpoint no painel do MP
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      // respondemos 200 para evitar reenvio em loop, mas marcamos motivo
      return NextResponse.json({ ok: false, reason: "no token" }, { status: 200 });
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

    if (eventType.toLowerCase().includes("payment") && paymentId) {
      const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        console.warn("[MP PAYMENT] fetch not ok", txt);
        return NextResponse.json({ ok: false }, { status: 200 });
      }

      const payment = (await res.json()) as MpPayment;

      console.log(
        "[MP PAYMENT]",
        "id:", payment.id,
        "status:", payment.status,
        "detail:", payment.status_detail,
        "extRef:", payment.external_reference
      );

      const pedidoId = payment.external_reference ?? undefined;

      if (pedidoId) {
        const novoStatus = mapMpStatusToPedidoStatus(payment.status);

        // Atualiza documento principal do pedido
        await adminDb.collection("pedidos").doc(pedidoId).set(
          {
            status: novoStatus,
            mp: {
              id: String(payment.id),
              status: payment.status ?? null,
              status_detail: payment.status_detail ?? null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            // se quiser gravar um "pagoEm" quando aprovado:
            ...(payment.status?.toLowerCase() === "approved"
              ? { pagoEm: admin.firestore.FieldValue.serverTimestamp() }
              : {}),
          },
          { merge: true }
        );

        // Loga histórico
        await adminDb
          .collection("pedidos")
          .doc(pedidoId)
          .collection("historico")
          .add({
            origem: "mercado_pago_webhook",
            mp_id: String(payment.id),
            status: payment.status ?? null,
            status_detail: payment.status_detail ?? null,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });

        console.log("[PEDIDO] atualizado via webhook:", pedidoId, "=>", novoStatus);
      } else {
        console.warn("[MP PAYMENT] sem external_reference; nada para sincronizar.");
      }
    }

    // Sempre 200 para evitar reenvio infinito
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[MP WEBHOOK ERROR]", e);
    // 200 evita reenvio em loop quando algo falhou na nossa lógica
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
