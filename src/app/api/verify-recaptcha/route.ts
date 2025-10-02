// src/app/api/verify-recaptcha/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime   = 'nodejs';         // força rodar em Node (não em Edge)
export const dynamic   = 'force-dynamic';  // sem cache/pré-render
export const revalidate = 0;               // nunca revalidar

// Opcional: limite o CORS ao domínio do site em produção
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? '';

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  // Se foi configurado um domínio, só libera se bater
  const allow =
    SITE_ORIGIN && origin.startsWith(SITE_ORIGIN) ? origin : '*';

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Responde ao preflight do navegador (App Router exige esse handler)
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
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    // evita ficar pendurado; Node 18+ tem AbortSignal.timeout
    signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(8000) : undefined,
    cache: 'no-store',
    keepalive: false,
  });

  // Mesmo que não seja 2xx, muitas vezes o Google retorna JSON de erro.
  let data: GoogleResp;
  try {
    data = (await resp.json()) as GoogleResp;
  } catch {
    // Falhou em parsear JSON — trate como erro genérico
    data = { success: false, 'error-codes': ['bad-response'] };
  }
  return data;
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);

  try {
    const { token } = (await req.json().catch(() => ({}))) as {
      token?: string;
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

    // Se quiser, envie o IP do usuário (ajuda o Google a validar)
    const remoteip =
      req.headers.get('x-forwarded-for') ??
      req.headers.get('x-real-ip') ??
      undefined;

    const params = new URLSearchParams({ secret, response: token });
    if (remoteip) params.set('remoteip', remoteip);

    // Tenta pelo endpoint padrão e depois pelo fallback (China/Firewalls)
    const endpoints = [
      'https://www.google.com/recaptcha/api/siteverify',
      'https://www.recaptcha.net/recaptcha/api/siteverify',
    ];

    let result: GoogleResp | null = null;

    for (const url of endpoints) {
      try {
        const data = await verifyWithGoogle(params, url);
        result = data;
        // Se veio sucesso ou já temos um erro bem formado, não precisa tentar o próximo
        if (data?.success || Array.isArray(data?.['error-codes'])) break;
      } catch {
        // tenta o próximo endpoint
      }
    }

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'verification failed' },
        { status: 502, headers }
      );
    }

    if (!result.success) {
      const codes = Array.isArray(result['error-codes'])
        ? result['error-codes']
        : [];

      // Tradução amigável (opcional)
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
        { success: false, reason, data: result },
        { status: 400, headers }
      );
    }

    // OK
    return NextResponse.json(
      {
        success: true,
        // campos úteis do v2:
        challenge_ts: result.challenge_ts,
        hostname: result.hostname,
      },
      { status: 200, headers }
    );
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    // Trate timeouts explicitamente
    const status = /AbortError/i.test(e?.name) ? 504 : 500;

    return NextResponse.json(
      { success: false, error: msg },
      { status, headers }
    );
  }
}
