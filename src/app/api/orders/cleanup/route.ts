// src/app/api/orders/cleanup/route.ts
import { NextResponse } from 'next/server';
import { admin, afs } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const now = admin.firestore.Timestamp.now();
    const pendentes = await afs
      .collection('pedidos')
      .where('status', 'in', ['Aguardando pagamento', 'Aguardando pagamento (Pix)'])
      .where('expiresAt', '<=', now)
      .get();

    const batch = afs.batch();
    pendentes.forEach((doc) => {
      batch.set(
        doc.ref,
        {
          status: 'Cancelado',
          canceladoEm: admin.firestore.FieldValue.serverTimestamp(),
          canceladoMotivo: 'Pagamento não concluído em 24h',
          atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    if (!pendentes.empty) await batch.commit();

    return NextResponse.json({ ok: true, updated: pendentes.size });
  } catch (e) {
    console.error('cleanup error', e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'orders/cleanup' });
}
