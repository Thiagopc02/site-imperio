// src/app/api/mp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { admin, afs } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Notificação padrão enviada pelo Mercado Pago (formato "novo") */
type MPNotification = {
  action?: string;                 // ex: "payment.created" | "payment.updated"
  type?: string;                   // ex: "payment"
  data?: { id?: string | number }; // id do pagamento
};

/** Campos que realmente usamos do /v1/payments/{id} */
type MPPayment = {
  id: number;
  status:
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
  payment_method_id?:
    | 'pix'
    | 'credit_card'
    | 'debit_card'
    | 'account_money'
    | string;
  payment_type_id?:
    | 'credit_card'
    | 'debit_card'
    | 'account_money'
    | 'ticket'
    | 'bank_transfer'
    | string;

  /** ESSENCIAL para amarrar ao documento do pedido no Firestore */
  external_reference?: string | null;
};

/** Lê o body sem quebrar se vier vazio/`text/plain` */
async function parseBody(req: NextRequest): Promise<MPNotification | null> {
  try {
    const ct = (req.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      return (await req.json()) as MPNotification;
    }
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as MPNotification;
  } catch {
    return null;
  }
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
    });
    if (!res.ok) return null;

    const data = (await res.json()) as unknown;
    if (typeof (data as { id?: unknown }).id === 'number') {
      return data as MPPayment;
    }
    return null;
  } catch {
    return null;
  }
}

/** Mapeia o status do MP para o status usado no painel */
function mapPaymentStatus(p: MPPayment | null): string {
  if (!p) return 'Em andamento';
  switch (p.status) {
    case 'approved':
      return 'Confirmado';
    case 'pending':
    case 'in_process':
      return 'Aguardando pagamento (Pix)';
    case 'rejected':
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Em andamento';
  }
}

/** Converte método de pagamento do MP para o texto do painel */
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

/** Extrai o ID do pagamento tanto do body quanto de querystring antiga (?id=&topic=) */
async function extractPaymentId(req: NextRequest): Promise<string | null> {
  // 1) Formato novo (payload JSON)
  const payload = await parseBody(req);
  const idFromBody = payload?.data?.id ?? null;
  if (idFromBody != null && String(idFromBody).trim()) {
    return String(idFromBody).trim();
  }

  // 2) Formato antigo (?id=123&topic=payment)
  const search = req.nextUrl.searchParams;
  const topic = (search.get('topic') || search.get('type') || '').toLowerCase();
  const idQS = search.get('id');
  if ((topic === 'payment' || topic === 'payments') && idQS) {
    return idQS.trim();
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Sempre responder 200 (o MP reenvia em caso de 5xx)
    const paymentId = await extractPaymentId(req);
    if (!paymentId) {
      // Loga o raw quando vier sem id para ajudar debug
      const raw = await parseBody(req);
      await afs.collection('mp_logs').add({
        msg: 'Webhook sem paymentId',
        raw,
        recebidoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Enriquecer: buscar o pagamento
    const payment = await getPayment(paymentId);

    // Decidir qual doc atualizar:
    // Preferimos o external_reference (é o mesmo id do doc criado no carrinho),
    // senão caímos no fallback de usar o próprio paymentId.
    const docId = (payment?.external_reference || '').trim() || String(paymentId);

    const statusPainel = mapPaymentStatus(payment);
    const forma = mapFormaPagamento(payment);
    const valor =
      typeof payment?.transaction_amount === 'number' ? payment.transaction_amount : undefined;

    // Atualiza/cria o pedido correspondente
    await afs.collection('pedidos').doc(docId).set(
      {
        status: statusPainel,
        formaPagamento: forma ?? null,
        mpPaymentId: paymentId,
        mpStatus: payment?.status ?? null,
        mpStatusDetail: payment?.status_detail ?? null,
        ...(typeof valor === 'number' ? { total: valor } : {}),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Log detalhado para auditoria
    await afs.collection('mp_logs').doc(docId).set(
      {
        source: 'webhook',
        paymentId,
        payment: payment ?? null,
        recebidoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('MP webhook error', e);
    // Nunca devolva 5xx para não gerar retries infinitos
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

// GET “ping” – evita 404 se alguém acessar no navegador
export async function GET() {
  return NextResponse.json({ ok: true, route: 'mp/webhook' });
}
