// src/app/api/mp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Inicialização do admin (mantenha igual ao que já usa no projeto)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string)
    ),
  });
}
const afs = admin.firestore();

type MpPayment = {
  id: number;
  status: 'approved' | 'pending' | 'rejected' | string;
  status_detail?: string;
  external_reference?: string | null;
  payer?: { email?: string | null };
  transaction_amount?: number;
  payment_type_id?: string | null; // credit_card, debit_card, pix, etc
  additional_info?: unknown;
  metadata?: Record<string, unknown> | null;
};

export async function POST(req: NextRequest) {
  try {
    // Mercado Pago envia info nos query params
    const sp = req.nextUrl.searchParams;
    const type = sp.get('type');
    const paymentId = sp.get('data.id');

    if (type !== 'payment' || !paymentId) {
      // alguns eventos podem vir diferentes; ignore o que não precisamos
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    // Busca o pagamento na API do MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, // token secreto
      },
    });

    if (!mpRes.ok) {
      const t = await mpRes.text();
      console.error('MP get payment FAIL:', t);
      return NextResponse.json({ error: 'mp-fetch-failed' }, { status: 500 });
    }

    const payment = (await mpRes.json()) as MpPayment;

    const pedidoId = (payment.external_reference ?? '').toString();
    if (!pedidoId) {
      // sem external_reference não sabemos quem é o pedido
      console.warn('Webhook sem external_reference. Payment:', payment.id);
      return NextResponse.json({ ok: true, missingExternalRef: true }, { status: 200 });
    }

    // Mapeia status do MP para status interno
    let statusInterno: string = 'Em andamento';
    if (payment.status === 'approved') statusInterno = 'Pago';
    else if (payment.status === 'pending') statusInterno = 'Aguardando pagamento (Pix)';

    // Base do documento do pedido (merge)
    const baseDoc = {
      mp: {
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail ?? null,
        payment_type_id: payment.payment_type_id ?? null,
      },
      status: statusInterno,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Atualiza/cria o pedido pelo ID (external_reference)
    await afs.collection('pedidos').doc(pedidoId).set(baseDoc, { merge: true });

    // (Opcional) log técnico
    await afs.collection('mp_logs').doc(String(payment.id)).set({
      payment,
      recebidoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('MP webhook error:', e);
    return NextResponse.json({ error: 'webhook-fail' }, { status: 500 });
  }
}
