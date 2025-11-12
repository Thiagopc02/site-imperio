// src/app/api/mp/payment-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const tok = process.env.MP_ACCESS_TOKEN;
    if (!id || !tok) return NextResponse.json({ ok: false }, { status: 200 });

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${tok}` },
      cache: 'no-store',
    });
    const json = await r.json().catch(() => ({}));
    return NextResponse.json({ ok: r.ok, status: r.status, payment: json });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
