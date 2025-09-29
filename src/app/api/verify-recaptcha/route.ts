import { NextRequest, NextResponse } from 'next/server';

/**
 * Verifica o token do reCAPTCHA v2 invisível no servidor.
 * Lê a chave secreta do .env.local: RECAPTCHA_V2_SECRET_KEY
 */
export async function POST(req: NextRequest) {
  // CORS básico p/ chamadas do próprio app (útil em LAN)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  } as const;

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

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

    // envia ao endpoint oficial do Google
    const params = new URLSearchParams({ secret, response: token });
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      // timeout simples com AbortController (evita ficar pendurado)
      signal: AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined,
    });

    const data = await resp.json(); // { success: boolean, 'error-codes'?: string[] ... }

    // se falhou, converte os códigos em texto amigável
    if (!data?.success) {
      const codes: string[] = Array.isArray(data?.['error-codes']) ? data['error-codes'] : [];
      const reason =
        codes
          .map((c) => {
            switch (c) {
              case 'invalid-input-secret':
                return 'Server secret inválido';
              case 'missing-input-secret':
                return 'Server secret ausente';
              case 'missing-input-response':
                return 'Token ausente';
              case 'invalid-input-response':
                return 'Token inválido ou expirado';
              case 'bad-request':
                return 'Requisição inválida';
              case 'timeout-or-duplicate':
                return 'Token expirado ou reutilizado';
              default:
                return c;
            }
          })
          .join(', ') || 'unknown';

      return NextResponse.json(
        { success: false, reason, data },
        { status: 400, headers: corsHeaders },
      );
    }

    // OK
    return NextResponse.json(
      { success: true, data },
      { status: 200, headers: corsHeaders },
    );
  } catch (e: any) {
    // abort/timeout
    if (e?.name === 'AbortError') {
      return NextResponse.json(
        { success: false, error: 'recaptcha verify timeout' },
        { status: 504, headers: corsHeaders },
      );
    }
    return NextResponse.json(
      { success: false, error: String(e?.message ?? e) },
      { status: 500, headers: corsHeaders },
    );
  }
}
