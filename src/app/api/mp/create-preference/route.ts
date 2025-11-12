// src/app/api/mp/create-preference/route.ts
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const accessToken = process.env.MP_ACCESS_TOKEN;

    if (!body || !accessToken) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const pref = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await pref.json().catch(() => ({}));
    return NextResponse.json({ ok: pref.ok, status: pref.status, preference: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'mp/create-preference' });
}
