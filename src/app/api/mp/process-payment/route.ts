// src/app/api/mp/process-payment/route.ts
import { NextRequest, NextResponse } from 'next/server';

// O SDK do MP e o fetch para /v1/payments exigem Node.js (não use Edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Payload esperado pela API /v1/payments do Mercado Pago */
type MPCreatePaymentIn = {
  transaction_amount: number;
  token?: string; // token de cartão (não é usado para Pix/Boleto)
  description?: string;
  installments?: number;
  payment_method_id: string; // 'pix' | 'bolbradesco' | 'credit_card' | ...
  issuer_id?: string | number;
  payer: {
    email: string;
    first_name?: string;
    last_name?: string;
    identification?: { type?: string; number?: string };
  };
};

/** Payload que de fato enviaremos (com pequenas normalizações) */
type MPCreatePaymentPayload = MPCreatePaymentIn & {
  binary_mode: boolean;
};

async function parseJson<T = unknown>(req: NextRequest): Promise<T | null> {
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) return (await req.json()) as T;
    const text = await req.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms = 25_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

export async function POST(req: NextRequest) {
  try {
    // 1) Lê o corpo vindo do Brick
    const body = await parseJson<MPCreatePaymentIn>(req);
    if (!body) {
      // Nunca devolva 4xx/5xx pro Brick — sempre 200 com um "ok: false"
      return NextResponse.json({ ok: false, error: 'empty-body' }, { status: 200 });
    }

    // 2) Access Token do servidor (NUNCA use a public key aqui)
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'missing-token' }, { status: 200 });
    }

    // 3) Normaliza e monta o payload final
    const payload: MPCreatePaymentPayload = {
      ...body,
      transaction_amount: Number(body.transaction_amount || 0),
      description: body.description || 'Pedido - Império Distribuidora',
      binary_mode: true, // evita ficar em "pending" por análise de risco
    };

    // 4) Chama a API de Payments do Mercado Pago
    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const mpResp = await withTimeout(
      fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
    );

    const data = (await mpResp.json().catch(() => ({}))) as unknown;

    // Sucesso costuma ser 201; algumas contas retornam 200
    const ok = mpResp.ok && (mpResp.status === 201 || mpResp.status === 200);

    return NextResponse.json(
      {
        ok,
        status: mpResp.status,
        payment: data,
      },
      { status: 200 }
    );
  } catch (e) {
    // IMPORTANTE: SEMPRE status 200 pro Brick não “congelar”
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}

// Ping de saúde / evita erro em GET
export async function GET() {
  return NextResponse.json({ ok: true, route: 'mp/process-payment' });
}
