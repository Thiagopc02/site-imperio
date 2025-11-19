// src/app/api/mp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { admin, afs } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MPNotification = {
  action?: string;
  type?: string;
  data?: { id?: string | number } | null;
};

type MPPayment = {
  id?: string | number;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  payment_type_id?: string;
  external_reference?: string | null;
  payer?: { email?: string | null } | null;
  metadata?: {
    orderId?: string;
    [key: string]: unknown;
  } | null;
};

/* ---------- Buscar pagamento completo no MP ---------- */
async function getPayment(paymentId: string): Promise<MPPayment | null> {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error('[MP Webhook] MP_ACCESS_TOKEN não configurado');
    return null;
  }

  try {
    const url = `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
      paymentId
    )}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (res.status === 404) {
      console.warn(
        '[MP Webhook] Pagamento não encontrado no MP (404) para id:',
        paymentId
      );
      return null;
    }

    if (!res.ok) {
      console.error(
        '[MP Webhook] Erro ao buscar pagamento no MP',
        res.status,
        await res.text()
      );
      return null;
    }

    return (await res.json()) as MPPayment;
  } catch (err) {
    console.error(
      '[MP Webhook] Erro de rede ao buscar pagamento no MP',
      err
    );
    return null;
  }
}

/* ---------- Inferir formaPagamento a partir do pagamento ---------- */
function mapFormaPagamento(
  p: MPPayment | null
): 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'online' | undefined {
  if (!p) return undefined;
  const method = (p.payment_method_id || p.payment_type_id || '').toLowerCase();

  if (method.includes('pix')) return 'pix';
  if (method.includes('credit')) return 'cartao_credito';
  if (method.includes('debit')) return 'cartao_debito';

  // qualquer outra coisa tratamos como pagamento online
  return 'online';
}

/* ===================== POST ===================== */
export async function POST(req: NextRequest) {
  // Lê body cru uma vez
  let rawBody = '';
  let body: MPNotification | null = null;

  try {
    rawBody = await req.text();
    body = rawBody ? (JSON.parse(rawBody) as MPNotification) : null;
  } catch {
    body = null;
  }

  const headers = Object.fromEntries(req.headers);

  // 1) ID pelo body
  const idFromBody = body?.data?.id;
  // 2) Fallback: querystring ?id= / ?data.id= / ?payment_id=
  const search = req.nextUrl.searchParams;
  const idFromQS =
    search.get('id') ||
    search.get('data.id') ||
    search.get('payment_id') ||
    null;

  const paymentId = String(idFromBody ?? idFromQS ?? '').trim();

  if (!paymentId) {
    await afs.collection('mp_logs').add({
      msg: 'Webhook sem paymentId',
      rawBody,
      headers,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // responde 200 para não tomar retry infinito do MP
    return NextResponse.json({ ok: true, ignored: true, reason: 'no payment id' });
  }

  const payment = await getPayment(paymentId);

  if (!payment) {
    await afs.collection('mp_logs').add({
      msg: 'Pagamento não encontrado no MP',
      paymentId,
      rawBody,
      headers,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: 'payment not found',
    });
  }

  // *** AQUI ESTÁ O PONTO PRINCIPAL ***
  // Usamos SOMENTE metadata.orderId para achar o pedido.
  const orderId = String(payment.metadata?.orderId ?? '').trim();

  if (!orderId) {
    await afs.collection('mp_logs').add({
      msg: 'Pagamento sem metadata.orderId',
      paymentId,
      paymentMetadata: payment.metadata ?? null,
      rawBody,
      headers,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Não inventamos ID, não criamos pedido novo.
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: 'no metadata.orderId',
    });
  }

  const docRef = afs.collection('pedidos').doc(orderId);

  const formaPagamento = mapFormaPagamento(payment);
  const payerEmail = payment.payer?.email ?? null;

  const updateData: Record<string, unknown> = {
    mpPaymentId: paymentId,
    mp_status: payment.status ?? null,
    mp_status_detail: payment.status_detail ?? null,
    payerEmail,
    mp_snapshot: payment,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Atualiza formaPagamento só se conseguimos inferir algo
  if (formaPagamento) {
    updateData.formaPagamento = formaPagamento;
  }

  try {
    // *** IMPORTANTE: não mexemos no campo "status" do pedido! ***
    await docRef.set(updateData, { merge: true });

    await afs.collection('mp_logs').doc(orderId).set(
      {
        source: 'webhook',
        paymentId,
        orderId,
        rawBody,
        headers,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('[MP Webhook] Erro ao atualizar Firestore', err);

    return NextResponse.json({
      ok: true,
      firestoreError: String(err),
    });
  }

  return NextResponse.json({ ok: true });
}

/* ---------- GET de teste (ping) ---------- */
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/mp/webhook' });
}
