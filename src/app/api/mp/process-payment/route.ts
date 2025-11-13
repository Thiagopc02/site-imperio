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
  external_reference?: string;
  metadata?: Record<string, unknown>;
};

type MPPaymentResponse = {
  id?: number;
  status?: string;
  status_detail?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  transaction_amount?: number;
  error?: string;
  message?: string;
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
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
function genExternalRef() {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  try {
    const bodyIn = (await parseJson(req)) as MPBricksFormData | null;
    if (!bodyIn) return NextResponse.json({ ok: false, message: 'empty-body' }, { status: 200 });

    const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
    if (!accessToken) return NextResponse.json({ ok: false, message: 'missing-token' }, { status: 200 });

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      'https://imperiodistribuidora3015.com.br';

    // Pega external_reference do body, header X-External-Ref, query ?ref=, ou gera.
    const headerRef = req.headers.get('x-external-ref') || undefined;
    const qsRef = req.nextUrl.searchParams.get('ref') || undefined;
    const external_reference =
      (bodyIn.external_reference || headerRef || qsRef || '').trim() || genExternalRef();

    const amount = Number(bodyIn.transaction_amount ?? 0);
    const payerEmail = (bodyIn.payer?.email || '').toString().trim() || 'comprador-teste@example.com';

    const payload = {
      ...bodyIn,
      transaction_amount: Number.isFinite(amount) && amount > 0 ? amount : 0.01,
      description: bodyIn.description || 'Pedido - Império Distribuidora',
      binary_mode: true,
      external_reference,
      notification_url: `${baseUrl}/api/webhook`,
      payer: { ...(bodyIn.payer || {}), email: payerEmail },
      metadata: {
        ...(bodyIn.metadata || {}),
        source: 'payment-bricks',
      },
      // statement_descriptor poderia ser configurado na sua conta MP
    };

    const idemKey = `${payerEmail}-${external_reference}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    const mpResp = await withTimeout(
      fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idemKey,
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }),
      25_000
    );

    const data: MPPaymentResponse = await mpResp.json().catch(() => ({} as MPPaymentResponse));
    const ok = mpResp.ok && (mpResp.status === 201 || mpResp.status === 200);

    return NextResponse.json(
      {
        ok,
        status: mpResp.status,
        payment: data,
        external_reference,
        error: ok
          ? undefined
          : data?.message || data?.error || data?.cause?.[0]?.description || String(data?.cause?.[0]?.code ?? ''),
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
