// src/app/api/mp/process-payment/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MPBricksFormData = {
  transaction_amount?: number;
  description?: string;
  installments?: number;
  payment_method_id?: string;
  issuer_id?: string | number;
  token?: string;
  payer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    identification?: { type?: string; number?: string };
  };
};

// resposta “genérica” de /v1/payments que nos importa
type MPPaymentResponse = {
  id?: number;
  status?: string;
  status_detail?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  transaction_amount?: number;
  // campos de erro
  message?: string;
  error?: string;
  cause?: Array<{ code?: string | number; description?: string }>;
  [k: string]: unknown;
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

function withTimeout<T>(p: Promise<T>, ms = 25_000) {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await parseJson(req)) as MPBricksFormData | null;
    if (!body) {
      return NextResponse.json({ ok: false, message: 'empty-body' }, { status: 200 });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      return NextResponse.json({ ok: false, message: 'missing-token' }, { status: 200 });
    }

    const amount = Number(body.transaction_amount ?? 0);
    const payerEmail =
      (body.payer?.email || '').toString().trim() || 'comprador-teste@example.com';

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      'https://imperiodistribuidora3015.com.br';

    const payload: MPBricksFormData & {
      binary_mode: boolean;
      notification_url: string;
      transaction_amount: number;
      payer: NonNullable<MPBricksFormData['payer']>;
    } = {
      ...body,
      transaction_amount: Number.isFinite(amount) && amount > 0 ? amount : 0.01,
      description: body.description || 'Pedido - Império Distribuidora',
      binary_mode: true,
      notification_url: `${baseUrl}/api/mp/webhook`,
      payer: {
        ...(body.payer || {}),
        email: payerEmail,
      },
    };

    const idemKey =
      `${payerEmail}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const mpResp = await withTimeout(
      fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idemKey,
        },
        body: JSON.stringify(payload),
      }),
      25_000
    );

    const data: MPPaymentResponse = await mpResp.json().catch(
      () => ({} as MPPaymentResponse)
    );

    const ok =
      mpResp.ok &&
      (mpResp.status === 201 || mpResp.status === 200) &&
      typeof data === 'object';

    return NextResponse.json(
      {
        ok,
        status: mpResp.status,
        payment: data,
        error: ok
          ? undefined
          : data?.message ||
            data?.error ||
            data?.cause?.[0]?.description ||
            String(data?.cause?.[0]?.code ?? ''),
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'mp/process-payment' });
}
