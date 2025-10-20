// app/api/mp/webhook/route.ts
import { NextResponse } from 'next/server';

const MP_API = process.env.MP_API || 'https://api.mercadopago.com';
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

// Opcional: se quiser rodar na Edge, descomente
// export const runtime = 'edge';

export async function GET() {
  // Alguns ambientes (ou verificações) batem via GET
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    if (!ACCESS_TOKEN) {
      // Mesmo sem token retornamos 200 para não gerar loop de reenvio
      console.error('[MP WEBHOOK] MP_ACCESS_TOKEN ausente');
      return NextResponse.json({ ok: true });
    }

    // 1) Tenta ler o corpo (formato atual do MP)
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    // 2) Também considera o formato legado via querystring (?topic=payment&id=123)
    const url = new URL(req.url);
    const topicQs = url.searchParams.get('type') || url.searchParams.get('topic');
    const idQs = url.searchParams.get('id') || url.searchParams.get('data.id');

    // 3) Extrai campos do corpo (vários formatos possíveis)
    const topicBody =
      body?.type ||
      body?.topic ||
      body?.action || // às vezes vem "payment.created"
      undefined;

    const idBody =
      body?.data?.id ||
      body?.resource?.id ||
      body?.id ||
      body?.data_id ||
      undefined;

    const topic = (topicBody || topicQs || 'unknown').toString().toLowerCase();
    const entityId = (idBody || idQs || '').toString();

    // Logs simples (evite em produção)
    console.log('[MP WEBHOOK] topic:', topic, 'id:', entityId);
    // Se vier o header de request-id, é útil para rastreio
    const reqId = (req.headers.get('x-request-id') || '').toString();
    if (reqId) console.log('[MP WEBHOOK] x-request-id:', reqId);

    // 4) Ignora notificações de teste explícitas
    if (topic.includes('test')) {
      return NextResponse.json({ received: true });
    }

    // 5) Quando for sobre pagamento, busca detalhes
    if ((topic.includes('payment') || topic.includes('payments')) && entityId) {
      const res = await fetch(`${MP_API}/v1/payments/${entityId}`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        cache: 'no-store',
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error('[MP WEBHOOK] Falha ao consultar payment:', txt);
        // Mesmo assim, confirma recebimento
        return NextResponse.json({ received: true });
      }

      const payment = await res.json();

      // Campos úteis
      const status: string = payment?.status; // approved | pending | rejected | refunded | etc.
      const statusDetail: string = payment?.status_detail;
      const externalRef: string | undefined = payment?.external_reference;
      const prefId: string | undefined = payment?.collector_id || payment?.order?.id || payment?.point_of_interaction?.transaction_data?.qr_code; // pode variar

      console.log('[MP PAYMENT]', {
        id: entityId,
        status,
        statusDetail,
        externalRef,
      });

      // TODO: Atualizar pedido no Firestore:
      // - Localize pelo external_reference (ex.: order_... que criamos na preferência)
      // - Atualize status do pedido (approved/pending/rejected) e dados do pagamento
      //   Ex.:
      //   await updateOrderByExternalRef(externalRef, {
      //     paymentStatus: status,
      //     paymentStatusDetail: statusDetail,
      //     mpPaymentId: entityId,
      //     updatedAt: new Date().toISOString(),
      //   });

      return NextResponse.json({ received: true });
    }

    // 6) Merchant order (às vezes o MP notifica por merchant_order)
    if (topic.includes('merchant_order') && entityId) {
      const res = await fetch(`${MP_API}/merchant_orders/${entityId}`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        cache: 'no-store',
      });

      if (res.ok) {
        const mo = await res.json();
        console.log('[MP MERCHANT_ORDER]', {
          id: mo?.id,
          preferenceId: mo?.preference_id,
          status: mo?.order_status,
          totalPaid: mo?.payments?.reduce((s: number, p: any) => s + (p.total_paid_amount || 0), 0),
          externalRef: mo?.external_reference,
        });

        // TODO: se preferir, também pode conciliar o pedido via merchant_order
      } else {
        const txt = await res.text();
        console.error('[MP MERCHANT_ORDER] Falha ao consultar merchant_order:', txt);
      }

      return NextResponse.json({ received: true });
    }

    // 7) Outros tópicos: apenas confirme o recebimento
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[MP WEBHOOK ERROR]', e);
    // Retornar 200 evita que o MP reenfileire o evento em loop
    return NextResponse.json({ received: true });
  }
}
