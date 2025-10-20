import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Body que vem do front para criar/capturar o pagamento */
type ProcessPaymentBody = {
  token: string; // token do card / pix token, etc (vindo do Brick)
  transaction_amount: number;
  payment_method_id: string; // 'visa' | 'master' | 'pix' | etc
  installments?: number;
  issuer_id?: string;
  preference_id?: string;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
  additional_info?: unknown;
};

/** Campos essenciais que voltam do Mercado Pago */
type MPCreatePaymentResponse = {
  id: number;
  status:
    | 'approved'
    | 'rejected'
    | 'in_process'
    | 'pending'
    | 'cancelled'
    | 'refunded'
    | 'in_mediation';
  status_detail?: string;
  payment_method_id?: string;
  order?: { id?: string } | null; // pode conter o preference_id em alguns fluxos
  [k: string]: unknown; // preserva demais campos sem usar `any`
};

export async function POST(req: Request) {
  try {
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'ACCESS TOKEN ausente no servidor' },
        { status: 500 }
      );
    }

    const body = (await req.json()) as ProcessPaymentBody;

    // validações mínimas
    if (
      !body?.token ||
      typeof body.transaction_amount !== 'number' ||
      !body.payment_method_id
    ) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      );
    }

    // monta o payload conforme docs do MP
    const payload = {
      token: body.token,
      transaction_amount: body.transaction_amount,
      payment_method_id: body.payment_method_id,
      installments: body.installments ?? 1,
      issuer_id: body.issuer_id,
      payer: body.payer,
      additional_info: body.additional_info,
      // você pode adicionar statement_descriptor, notification_url, etc
    };

    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      // IMPORTANTE: não usar cache em chamada de pagamento
      cache: 'no-store',
    });

    const json = (await res.json()) as MPCreatePaymentResponse;

    if (!res.ok) {
      console.error('MP /v1/payments error:', json);
      return NextResponse.json(
        { error: 'Falha ao processar pagamento', details: json },
        { status: res.status }
      );
    }

    // devolve somente o necessário
    return NextResponse.json(
      {
        id: json.id,
        status: json.status,
        status_detail: json.status_detail,
        payment_method_id: json.payment_method_id,
        // alguns fluxos incluem o preference/order id aqui:
        preference_id: json.order?.id ?? null,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[process-payment] error:', message);
    return NextResponse.json({ error: 'Erro interno', message }, { status: 500 });
  }
}
