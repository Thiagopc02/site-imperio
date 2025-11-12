// src/app/api/mp/create-preference/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tipos mínimos do payload aceito pela API de Preferences */
type MPPreferenceItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: 'BRL' | string;
};

type MPPreferenceBody = {
  items: MPPreferenceItem[];
  payer?: {
    name?: string;
    email?: string;
    phone?: { number?: string };
  };
  external_reference?: string;
  shipment?: unknown;
  back_urls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
};

function isJson(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  return ct.includes('application/json');
}

export async function POST(req: NextRequest) {
  try {
    // Garante JSON mesmo se o cliente enviou como texto
    const raw = isJson(req) ? await req.json().catch(() => null) : JSON.parse(await req.text());
    const body = (raw ?? null) as MPPreferenceBody | null;

    const accessToken = process.env.MP_ACCESS_TOKEN;

    // validações básicas para evitar chamadas inúteis ao MP
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: 'missing-token' },
        // 200 poderia “mascarar” erro. Preferimos 400 para o seu front cair no branch de erro.
        { status: 400 }
      );
    }
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ ok: false, error: 'invalid-body' }, { status: 400 });
    }

    const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: unknown = await mpResp.json().catch(() => ({}));

    // Quando der erro no MP, devolvemos 400 para o seu front exibir mensagem correta
    if (!mpResp.ok) {
      return NextResponse.json(
        { ok: false, status: mpResp.status, preference: data },
        { status: 400 }
      );
    }

    // Em sucesso, o objeto possui "id" da preferência
    const pref = data as { id?: string };
    return NextResponse.json(
      {
        ok: true,
        status: mpResp.status,
        id: pref.id, // seu front pode ler .id ou .preferenceId
        preferenceId: pref.id,
        preference: data,
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'mp/create-preference' });
}
