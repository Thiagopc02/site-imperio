// src/app/api/orders/get/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { afs } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'missing-id' }, { status: 400 });

  const snap = await afs.collection('pedidos').doc(id).get();
  if (!snap.exists) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

  return NextResponse.json({ ok: true, pedido: { id: snap.id, ...snap.data() } });
}
