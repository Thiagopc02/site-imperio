// src/app/api/mp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { admin, afs } from '@/firebase/admin';

// Garante Node.js runtime (Firebase Admin não roda em Edge)
export const runtime = 'nodejs';
// Evita qualquer tentativa de estático/prerender
export const dynamic = 'force-dynamic';

type MPNotification = {
  action?: string;          // ex: "payment.created" | "payment.updated"
  type?: string;            // ex: "payment"
  data?: { id?: string | number }; // id do pagamento/merchant order (depende do tipo)
};

// parser tolerante (não quebra se o body vier vazio / inválido)
async function parseBody(req: NextRequest): Promise<MPNotification | null> {
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return (await req.json()) as MPNotification;
    }
    // fallback para texto (alguns provedores mandam `text/plain`)
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as MPNotification;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await parseBody(req);
    // Nunca quebre o webhook: responda 200 mesmo sem payload
    if (!payload) return NextResponse.json({ ok: true });

    const paymentId = String(payload.data?.id ?? '');
    const statusInterno =
      payload.action?.startsWith('payment.') || payload.type === 'payment'
        ? 'Aguardando pagamento (Pix)'
        : 'Em andamento';

    // Aqui você provavelmente vai correlacionar o paymentId com o seu pedido.
    // Como nem sempre temos o pedidoId no webhook, vamos gravar por paymentId
    // e o painel pode cruzar por esse campo.
    const docId = paymentId || `mp_${Date.now()}`;

    // Atualiza (ou cria) um doc de pedido com status
    await afs.collection('pedidos').doc(docId).set(
      {
        status: statusInterno,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // Log do raw (útil na auditoria/diagnóstico)
    await afs.collection('mp_logs').doc(docId).set(
      {
        raw: payload,
        recebidoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('MP webhook error', e);
    // Importante: não retornar 500 para não gerar re-tentativas infinitas no provedor
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

// Evita erro quando alguém (ou a Vercel) fizer GET nessa rota
export async function GET() {
  return NextResponse.json({ ok: true, route: 'mp/webhook' });
}
