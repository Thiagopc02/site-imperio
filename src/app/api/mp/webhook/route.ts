// src/app/api/mp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { admin, afs } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =========================
   Tipos mínimos (parciais)
   ========================= */
type MPNotification = {
  action?: string;                 // ex.: "payment.created" | "payment.updated"
  type?: string;                   // ex.: "payment"
  data?: { id?: string | number } | null;
};

type MPPayment = {
  id?: string | number;
  status?:
    | 'approved'
    | 'pending'
    | 'rejected'
    | 'in_process'
    | 'in_mediation'
    | 'cancelled'
    | 'refunded'
    | 'charged_back'
    | string;
  status_detail?: string;
  transaction_amount?: number;
  payment_method_id?: string;      // "pix", "credit_card", ...
  payment_type_id?: string;        // "pix", "ticket", "credit_card", ...
  external_reference?: string | null;
  payer?: { email?: string | null } | null;
};

/* =========================
   Helpers
   ========================= */

async function getPayment(paymentId: string): Promise<MPPayment | null> {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error('MP_ACCESS_TOKEN não configurado');
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

    if (!res.ok) {
      console.error('Erro ao buscar pagamento no MP', res.status);
      return null;
    }

    return (await res.json()) as MPPayment;
  } catch (err) {
    console.error('Erro de rede ao buscar pagamento no MP', err);
    return null;
  }
}

/** Status exibidos no painel */
function mapPaymentStatus(p: MPPayment | null): string {
  if (!p) return 'Em andamento';
  switch (p.status) {
    case 'approved':
      return 'Pago';
    case 'pending':
    case 'in_process':
      return 'Aguardando pagamento';
    case 'rejected':
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Em andamento';
  }
}

/** Forma de pagamento exibida no painel */
function mapFormaPagamento(
  p: MPPayment | null
): 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'online' | undefined {
  if (!p) return undefined;
  const method = (p.payment_method_id || p.payment_type_id || '').toLowerCase();
  if (method.includes('pix')) return 'pix';
  if (method.includes('credit')) return 'cartao_credito';
  if (method.includes('debit')) return 'cartao_debito';
  // para checkout online sempre tratamos como "online"
  return 'online';
}

/* =========================
   Handlers
   ========================= */

export async function POST(req: NextRequest) {
  // Lê o body UMA ÚNICA VEZ
  let rawBody = '';
  let body: MPNotification | null = null;

  try {
    rawBody = await req.text();
    body = rawBody ? (JSON.parse(rawBody) as MPNotification) : null;
  } catch {
    body = null;
  }

  const headers = Object.fromEntries(req.headers);

  // 1) Tenta pegar do JSON: data.id
  const idFromBody = body?.data?.id;

  // 2) Fallback para querystring: ?id=...&topic=payment
  const search = req.nextUrl.searchParams;
  const idFromQS =
    search.get('id') ||
    search.get('data.id') ||
    search.get('payment_id') ||
    null;

  const paymentId = String(idFromBody ?? idFromQS ?? '').trim();

  if (!paymentId) {
    // Loga pra debug, mas responde 200 pra evitar retries infinitos
    await afs.collection('mp_logs').add({
      msg: 'Webhook sem paymentId',
      rawBody,
      headers,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, ignored: true });
  }

  // Busca dados completos do pagamento no MP
  const payment = await getPayment(paymentId);

  // Decide qual documento vamos atualizar
  // Preferência: external_reference (que deve ser o id do pedido, ex: "order_...")
  const externalRef = (payment?.external_reference || '').trim();
  const docId = externalRef || `order_${paymentId}`;

  const statusPainel = mapPaymentStatus(payment);
  const formaPainel = mapFormaPagamento(payment);
  const valor =
    typeof payment?.transaction_amount === 'number'
      ? payment.transaction_amount
      : undefined;
  const payerEmail = payment?.payer?.email ?? null;

  // Atualiza o pedido no Firestore
  await afs.collection('pedidos').doc(docId).set(
    {
      status: statusPainel,
      formaPagamento: formaPainel ?? null,
      mpPaymentId: paymentId,
      mp_status: payment?.status ?? null,
      mp_status_detail: payment?.status_detail ?? null,
      payerEmail,
      ...(typeof valor === 'number' ? { total: valor } : {}),
      mp_snapshot: payment ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Log de auditoria
  await afs.collection('mp_logs').doc(docId).set(
    {
      source: 'webhook',
      paymentId,
      rawBody,
      headers,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}

// Ping opcional pra testar no navegador
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/mp/webhook' });
}
