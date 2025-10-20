// app/api/mp/process-payment/route.ts
import { NextResponse } from 'next/server';

const MP_API = process.env.MP_API || 'https://api.mercadopago.com';
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

export async function POST(req: Request) {
  try {
    if (!ACCESS_TOKEN) {
      return NextResponse.json({ error: 'MP_ACCESS_TOKEN ausente' }, { status: 500 });
    }

    // formData vem direto do Brick
    const body = await req.json();

    // valores adicionais que mandamos do front:
    const {
      transaction_amount,          // number
      description,                 // string
      preferenceId,                // opcional (para amarrar com a preferência e webhooks)
    } = body;

    // Dica: limite global 12x; se o usuário não escolher, força 1x
    const installments = typeof body.installments === 'number' ? body.installments : 1;
    const finalInstallments = Math.min(Math.max(installments, 1), 12);

    // Monta payload aceito por /v1/payments
    // O próprio body do Brick já contém os campos dinâmicos
    const payload = {
      ...body,
      transaction_amount,
      description,
      installments: finalInstallments,
      // amarração com preferência e webhook
      notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/mp/webhook`,
      external_reference: body.external_reference ?? `order_${Date.now()}`,
      // se quiser atrelar à preferência criada:
      // additional_info: { ... } // opcional
    };

    const res = await fetch(`${MP_API}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const json = await res.json();

    if (!res.ok) {
      console.error('MP /v1/payments error:', json);
      return NextResponse.json({ error: 'Falha ao processar pagamento', details: json }, { status: 400 });
    }

    // retorna dados para a tela decidir pra onde ir
    return NextResponse.json({
      id: json.id,
      status: json.status,                 // approved | pending | rejected | etc.
      status_detail: json.status_detail,
      payment_method_id: json.payment_method_id,
      preference_id: preferenceId ?? json.order?.id ?? null,
    });
  } catch (e: any) {
    console.error('[process-payment] error:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
