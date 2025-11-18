// src/app/api/mp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { admin, afs } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- Tipos ---------- */

type MPNotification = {
  action?: string;
  type?: string;
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
  payment_method_id?: string;
  payment_type_id?: string;
  external_reference?: string | null;
  payer?: { email?: string | null } | null;
  metadata?: {
    orderId?: string;
    order_id?: string;
    external_reference?: string;
    [key: string]: unknown;
  } | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
      external_resource_url?: string;
    };
  };
};

/* ---------- Helpers ---------- */

function safeString(v: unknown | null | undefined): string {
  if (v == null) return '';
  return String(v).trim();
}

/** Extrai o paymentId – primeiro da query (?id=..., ?topic=payment), depois do body JSON (data.id) */
async function extractPaymentId(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);

  // 1) Querystring (padrão antigo)
  const qsId = url.searchParams.get('id');
  const topic =
    (url.searchParams.get('topic') ||
      url.searchParams.get('type') ||
      '')?.toLowerCase();

  if (qsId && (!topic || topic === 'payment' || topic === 'payments')) {
    const s = safeString(qsId);
    if (s) return s;
  }

  // 2) Body JSON (padrão novo: Webhooks V2 – { data: { id } })
  try {
    const body = (await req.json()) as MPNotification;
    const id = body?.data?.id;
    const s = safeString(id);
    if (s) return s;
  } catch {
    // sem body ou não é JSON → ignora
  }

  return null;
}

/** Busca o pagamento no Mercado Pago */
async function getPayment(paymentId: string): Promise<MPPayment | null> {
  const token = safeString(process.env.MP_ACCESS_TOKEN);
  if (!token) return null;

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
      console.error('MP getPayment not ok', res.status, await res.text());
      return null;
    }

    return (await res.json()) as MPPayment;
  } catch (err) {
    console.error('MP getPayment error', err);
    return null;
  }
}

/** Mapeia status do MP para o status que aparece no painel */
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

/** Mapeia método de pagamento para o campo formaPagamento do pedido */
function mapFormaPagamento(
  p: MPPayment | null
): 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | undefined {
  if (!p) return undefined;
  const method = (
    p.payment_method_id ||
    p.payment_type_id ||
    ''
  ).toLowerCase();

  if (method.includes('pix')) return 'pix';
  if (method.includes('credit')) return 'cartao_credito';
  if (method.includes('debit')) return 'cartao_debito';
  return undefined;
}

/* ---------- Handlers ---------- */

export async function POST(req: NextRequest) {
  try {
    const paymentId = await extractPaymentId(req);

    if (!paymentId) {
      // Sem ID → só loga e retorna 200 pra não ficar em retry infinito
      await afs.collection('mp_logs').add({
        msg: 'Webhook sem paymentId',
        url: req.url,
        headers: Object.fromEntries(req.headers),
        recebidoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ ok: true, ignored: true });
    }

    const payment = await getPayment(paymentId);

    const statusPainel = mapPaymentStatus(payment);
    const formaPainel = mapFormaPagamento(payment);
    const valor =
      typeof payment?.transaction_amount === 'number'
        ? payment.transaction_amount
        : undefined;

    const payerEmail = payment?.payer?.email || null;

    // Tentamos descobrir QUAL documento de pedido atualizar:
    // 1) external_reference (se você estiver mandando o orderId lá)
    // 2) metadata.orderId / metadata.order_id (caso tenha salvo no metadata)
    // 3) fallback: o próprio paymentId (cria um doc novo se não existir)
    const externalRef =
      safeString(payment?.external_reference) ||
      safeString(payment?.metadata?.orderId) ||
      safeString(payment?.metadata?.order_id);

    const docId = externalRef || paymentId;

    await afs
      .collection('pedidos')
      .doc(docId)
      .set(
        {
          status: statusPainel,
          formaPagamento: formaPainel ?? 'online',
          mpPaymentId: paymentId, // compatível com o tipo que você usa no front
          mp_payment_id: paymentId, // nome alternativo, se precisar
          mp_status: payment?.status ?? null,
          mp_status_detail: payment?.status_detail ?? null,
          payerEmail,
          ...(typeof valor === 'number' ? { total: valor } : {}),
          mp_snapshot: payment ?? null,
          atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    await afs
      .collection('mp_logs')
      .doc(docId)
      .set(
        {
          source: 'webhook',
          paymentId,
          url: req.url,
          headers: Object.fromEntries(req.headers),
          receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, docId });
  } catch (err) {
    console.error('MP webhook error', err);
    // sempre 200 pra não gerar retries infinitos
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

// Ping opcional pra testar no navegador
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/mp/webhook' });
}
