// src/app/api/mp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { admin, afs } from '@/firebase/admin';

// Garantir runtime Node e nada estático
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Notificação básica que o MP envia para webhooks */
type MPNotification = {
  action?: string;              // ex: "payment.created" | "payment.updated"
  type?: string;                // ex: "payment"
  data?: { id?: string | number };
};

/** Alguns campos que precisamos do pagamento no MP */
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
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    // validação simples de formato
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

export async function POST(req: NextRequest) {
  try {
    const payload = await parseBody(req);

    // Sempre responda 200 (não quebrar o webhook)
    if (!payload) return NextResponse.json({ ok: true });

    const paymentId = String(payload.data?.id ?? '').trim();
    // Tenta enriquecer com dados do pagamento
    const payment = paymentId ? await getPayment(paymentId) : null;

    const statusPainel = mapPaymentStatus(payment);
    const forma = mapFormaPagamento(payment);
    const valor = typeof payment?.transaction_amount === 'number'
      ? payment!.transaction_amount
      : undefined;

    // Usaremos o paymentId como docId. Se não vier, cria um id fallback.
    const docId = paymentId || `mp_${Date.now()}`;

    // Atualiza (ou cria) o pedido associado ao pagamento
    await afs.collection('pedidos').doc(docId).set(
      {
        status: statusPainel,
        formaPagamento: forma ?? null,
        mpPaymentId: paymentId || null,
        mpStatus: payment?.status ?? null,
        mpStatusDetail: payment?.status_detail ?? null,
        // Não incrementa total a menos que você queira; aqui só sobrepõe se existir valor
        ...(typeof valor === 'number' ? { total: valor } : {}),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // Log completo para auditoria
    await afs.collection('mp_logs').doc(docId).set(
      {
        raw: payload,
        payment: payment ?? null,
        recebidoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('MP webhook error', e);
    // Nunca devolva 500 para não gerar retries infinitos
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

// GET “ping” – evita 404 se alguém acessar no navegador
export async function GET() {
  return NextResponse.json({ ok: true, route: 'mp/webhook' });
}
