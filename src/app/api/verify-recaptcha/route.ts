// src/app/api/verify-recaptcha/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime    = 'nodejs';         // força Node (Edge pode bloquear fetch externo)
export const dynamic    = 'force-dynamic';  // sem cache
export const revalidate = 0;                // nunca revalidar

/**
 * Opcional: defina no Vercel/ENV p/ endurecer CORS em produção.
 * Ex.: NEXT_PUBLIC_SITE_ORIGIN=https://site-imperio.vercel.app
 */
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? '';

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow =
    SITE_ORIGIN && origin.startsWith(SITE_ORIGIN) ? origin : '*';

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Preflight (App Router exige esse handler)
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req),
  });
}

type GoogleResp = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
};

async function verifyWithGoogle(
  params: URLSearchParams,
  url: string
): Promise<GoogleResp> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
      signal: controller.signal,
    });

    // Mesmo em erro HTTP, Google costuma devolver JSON útil
    let data: GoogleResp;
    try {
      data = (await resp.json()) as GoogleResp;
    } catch {
      data = { success: false, 'error-codes': ['bad-response'] };
    }
    return data;
  } finally {
    clearTimeout(id);
  }
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);

  try {
    const { token, action } = (await req.json().catch(() => ({}))) as {
      token?: string;
      action?: string;
    };

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'missing token' },
        { status: 400, headers }
      );
    }

    const secret = process.env.RECAPTCHA_V2_SECRET_KEY;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: 'missing server secret' },
        { status: 500, headers }
      );
    }

    // IP ajuda o Google a validar. x-forwarded-for pode vir em lista: pegue o primeiro.
    const xff = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    const remoteip = xff || req.headers.get('x-real-ip') || undefined;

    const params = new URLSearchParams({ secret, response: token });
    if (remoteip) params.set('remoteip', remoteip);

    // Endpoint padrão + fallback (ex.: China/Firewalls)
    const endpoints = [
      'https://www.google.com/recaptcha/api/siteverify',
      'https://www.recaptcha.net/recaptcha/api/siteverify',
    ];

    let result: GoogleResp | null = null;

    for (const url of endpoints) {
      try {
        const data = await verifyWithGoogle(params, url);
        result = data;
        // Chega se sucesso, ou já temos erros claros
        if (data?.success || Array.isArray(data?.['error-codes'])) break;
      } catch {
        // tenta próximo endpoint
      }
    }

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'verification failed' },
        { status: 502, headers }
      );
    }

    if (!result.success) {
      const codes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];
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
        { success: false, reason, data: result, action },
        { status: 400, headers }
      );
    }

    // Sucesso
    return NextResponse.json(
      {
        success: true,
        challenge_ts: result.challenge_ts,
        hostname: result.hostname,
        action,
      },
      { status: 200, headers }
    );
  } catch (e: any) {
    const name = String(e?.name ?? '');
    const msg = String(e?.message ?? e);
    const status = /AbortError/i.test(name) ? 504 : 500;

    return NextResponse.json(
      { success: false, error: msg },
      { status, headers }
    );
  }
}
