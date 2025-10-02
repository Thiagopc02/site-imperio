// src/app/api/verify-recaptcha/route.ts
import { NextResponse } from 'next/server';

export const runtime   = 'nodejs';        // força Node.js (nada de Edge)
export const dynamic   = 'force-dynamic'; // impede cache/pré-render
export const revalidate = 0;              // sem revalidação

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { token } = await req.json().catch(() => ({} as { token?: string }));
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'missing token' },
        { status: 400, headers: corsHeaders },
      );
    }

    const secret = process.env.RECAPTCHA_V2_SECRET_KEY;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: 'missing server secret' },
        { status: 500, headers: corsHeaders },
      );
    }

    // Verifica no Google
    const body = new URLSearchParams({ secret, response: token }).toString();
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });

    const data = await resp.json(); // { success, 'error-codes'?, ... }

    if (!data?.success) {
      const codes = Array.isArray(data?.['error-codes']) ? data['error-codes'] : [];
      return NextResponse.json(
        { success: false, reason: codes.join(', '), data },
        { status: 400, headers: corsHeaders },
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: String(e?.message ?? e) },
      { status: 500, headers: corsHeaders },
    );
  }
}
