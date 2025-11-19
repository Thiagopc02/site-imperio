// src/app/api/mp/payment-status/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tipo “mínimo” do pagamento do MP que a gente usa
type MPPayment = {
  status?: string;
  status_detail?: string;
  [key: string]: unknown;
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const token = process.env.MP_ACCESS_TOKEN;

  if (!id || !token) {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing-params',
        message: !id
          ? 'payment id is required'
          : 'MP access token is missing',
      },
      { status: 200 }
    );
  }

  try {
    const resp = await fetch(
      `https://api.mercadopago.com/v1/payments/${id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      }
    );

    let payment: MPPayment = {};
    try {
      payment = (await resp.json()) as MPPayment;
    } catch {
      payment = {};
    }

    return NextResponse.json(
      {
        ok: resp.ok,
        httpStatus: resp.status,            // status HTTP da chamada
        paymentStatus: payment.status ?? null,       // approved, pending...
        statusDetail: payment.status_detail ?? null, // detalhe do MP
        payment,                             // objeto completo, se precisar
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[MP] payment-status error', error);
    return NextResponse.json(
      { ok: false, error: 'unexpected-error' },
      { status: 200 }
    );
  }
}
