// src/app/api/webhook/route.ts
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
  data?: { id?: string | number }; // id do pagamento
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
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;             // boleto
      external_resource_url?: string;  // link genérico
    };
  };
  charges_details?: Array<{
    card?: { last_four_digits?: string; holder_name?: string };
  }>;
};

/* =========================
   Helpers
   ========================= */

// (Opcional) Verifica assinatura dos Webhooks v2 (se MP_WEBHOOK_SECRET estiver definido)
async function verifySignatureIfPresent(req: NextRequest): Promise<boolean> {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) return true; // sem segredo configurado, não bloqueia

  try {
    const id = req.headers.get('x-request-id') || '';
    const signature = req.headers.get('x-signature') || '';
    if (!id || !signature) return true; // cabeçalhos ausentes: não trava

    // MP envia algo como: t=timestamp,v1=hash
    const parts = Object.fromEntries(signature.split(',').map(p => {
      const [k, v] = p.split('=');
      return [k?.trim(), (v || '').trim()];
    }));
    if (!parts.t || !parts.v1) return true;

    const rawBody = await req.text(); // precisamos do body "cru"
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');

    return hex === parts.v1;
  } catch {
    // Em dúvida, não bloqueia — apenas log
    return true;
  }
}

/** Lê body em JSON ou texto (sem quebrar) */
async function parseBody(req: NextRequest): Promise<MPNotification | null> {
  try {
    const ct = (req.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      return (await req.json()) as MPNotification;
    }
    // Quando usamos verifySignatureIfPresent, já consumimos o body.
    // Para contornar, capturamos de novo a URL e querystring, e só tentamos JSON se houver corpo.
    const txt = await req.text();
    if (!txt) return null;
    return JSON.parse(txt) as MPNotification;
  } catch {
    return null;
  }
}

/** Extrai o paymentId de vários formatos (novo + legado) */
async function extractPaymentId(req: NextRequest): Promise<string | null> {
  // 1) Novo: JSON com data.id
  const body = await parseBody(req);
  const idFromBody = body?.data?.id ?? null;
  if (idFromBody != null && String(idFromBody).trim()) {
    return String(idFromBody).trim();
  }

  // 2) Legado: ?id=...&topic=payment
  const search = req.nextUrl.searchParams;
  const topic = (search.get('topic') || search.get('type') || '').toLowerCase();
  const idQS = search.get('id');
  if ((topic === 'payment' || topic === 'payments') && idQS) {
    return idQS.trim();
  }

  return null;
}

/** Busca o pagamento no MP */
async function getPayment(paymentId: string): Promise<MPPayment | null> {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) return null;
  try {
    const url = `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as MPPayment;
  } catch {
    return null;
  }
}

/** Status exibidos no painel */
function mapPaymentStatus(p: MPPayment | null): string {
  if (!p) return 'Em andamento';
  switch (p.status) {
    case 'approved':     return 'Pago';
    case 'pending':
    case 'in_process':   return 'Aguardando pagamento';
    case 'rejected':
    case 'cancelled':    return 'Cancelado';
    default:             return 'Em andamento';
  }
}

/** Forma de pagamento exibida no painel */
function mapFormaPagamento(p: MPPayment | null):
  | 'pix'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'dinheiro'
  | undefined {
  if (!p) return undefined;
  const method = (p.payment_method_id || p.payment_type_id || '').toLowerCase();
  if (method.includes('pix')) return 'pix';
  if (method.includes('credit')) return 'cartao_credito';
  if (method.includes('debit')) return 'cartao_debito';
  return undefined;
}

/* =========================
   Handlers
   ========================= */
export async function POST(req: NextRequest) {
  try {
    // (Opcional) valida assinatura (não bloqueia se ausente)
    const okSig = await verifySignatureIfPresent(req);
    if (!okSig) {
      await afs.collection('mp_logs').add({
        msg: 'Assinatura inválida',
        recebidoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      // responde 200 mesmo assim para evitar retry em loop
      return NextResponse.json({ ok: true, invalidSignature: true });
    }

    // Sempre 200 (o MP reenvia em caso de 5xx)
    const paymentId = await extractPaymentId(req);
    if (!paymentId) {
      const raw = await parseBody(req);
      await afs.collection('mp_logs').add({
        msg: 'Webhook sem paymentId',
        raw,
        headers: Object.fromEntries(req.headers),
        recebidoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Enriquecimento
    const payment = await getPayment(paymentId);

    // Escolhe o documento (preferência: external_reference; senão, o próprio ID)
    const docId = (payment?.external_reference || '').trim() || String(paymentId);

    const statusPainel = mapPaymentStatus(payment);
    const formaPainel = mapFormaPagamento(payment);
    const valor = typeof payment?.transaction_amount === 'number' ? payment.transaction_amount : undefined;

    // Campos úteis adicionais para o painel (email do pagador ajuda a conciliar e disparar e-mails)
    const payerEmail = payment?.payer?.email || null;

    // Atualiza o pedido no Firestore
    await afs.collection('pedidos').doc(docId).set(
      {
        status: statusPainel,
        formaPagamento: formaPainel ?? null,
        mp_payment_id: paymentId,
        mp_status: payment?.status ?? null,
        mp_status_detail: payment?.status_detail ?? null,
        payerEmail,
        ...(typeof valor === 'number' ? { total: valor } : {}),
        // snapshot inteiro para o painel exibir comprovantes (PIX, boleto, cartão)
        mp_snapshot: payment ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Log (auditoria)
    await afs.collection('mp_logs').doc(docId).set(
      {
        source: 'webhook',
        paymentId,
        headers: Object.fromEntries(req.headers),
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('MP webhook error', e);
    // Nunca devolve 5xx para não gerar retries infinitos
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

// Ping opcional
export async function GET() {
  return NextResponse.json({ ok: true, route: 'webhook' });
}
