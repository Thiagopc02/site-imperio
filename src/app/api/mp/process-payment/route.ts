// src/app/api/mp/process-payment/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MPCreatePaymentIn = {
  transaction_amount: number;
  token?: string;
  description?: string;
  installments?: number;
  payment_method_id: string; // 'pix' | 'credit_card' | ...
  issuer_id?: string | number;
  payer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    identification?: { type?: string; number?: string };
  };
};

async function parseJson(req: NextRequest) {
  try {
    const ct = (req.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) return await req.json();
    const text = await req.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms = 25000) {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

// Gera um X-Idempotency-Key estável o suficiente para a criação do pagamento
function makeIdempotencyKey(body: MPCreatePaymentIn) {
  const email = (body?.payer?.email || '').toLowerCase().trim();
  const amt = Number(body?.transaction_amount || 0).toFixed(2);
  // Se vier um header do cliente, honramos; senão, geramos um.
  const base = `${email || 'anon'}:${amt}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  // MP aceita string arbitrária; mantemos curta.
  return `imp-${base}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await parseJson(req)) as MPCreatePaymentIn | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: 'empty-body' }, { status: 200 });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'missing-token' }, { status: 200 });
    }

    // Monta payload aceito pela API de payments
    const payload: MPCreatePaymentIn & { binary_mode: boolean; description: string } = {
      ...body,
      transaction_amount: Number(body.transaction_amount || 0),
      description: body.description || 'Pedido - Império Distribuidora',
      binary_mode: true, // evitar "pendente" por análise de risco
    };

    const idemKey =
      req.headers.get('x-idempotency-key')?.trim() || makeIdempotencyKey(payload);

    // Chamada à API do Mercado Pago
    const mpResp = await withTimeout(
      fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idemKey,
        },
        body: JSON.stringify(payload),
      })
    );

    const data = (await mpResp.json().catch(() => ({}))) as unknown;
    const ok = mpResp.ok && (mpResp.status === 201 || mpResp.status === 200);

    // Sempre retornamos 200 para o Bricks não travar o fluxo
    return NextResponse.json({
      ok,
      status: mpResp.status,
      payment: data,
    });
  } catch (e: unknown) {
    // Se der timeout ou outro erro, retornamos 200 com ok:false
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'mp/process-payment' });
}
