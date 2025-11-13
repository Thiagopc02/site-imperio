// src/app/api/mp/create-preference/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tipos mínimos */
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
  shipments?: unknown;
  back_urls?: { success?: string; failure?: string; pending?: string };
  notification_url?: string;
  metadata?: Record<string, unknown>;
};

function jsonOrText(req: NextRequest) {
  const ct = (req.headers.get('content-type') || '').toLowerCase();
  return ct.includes('application/json');
}

function genExternalRef() {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  try {
    const raw = jsonOrText(req) ? await req.json().catch(() => null) : JSON.parse(await req.text());
    const bodyIn = (raw ?? null) as MPPreferenceBody | null;

    const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'missing-token' }, { status: 400 });
    }
    if (!bodyIn || !Array.isArray(bodyIn.items) || bodyIn.items.length === 0) {
      return NextResponse.json({ ok: false, error: 'invalid-body' }, { status: 400 });
    }

    // Base URL do site (para webhook e back_urls)
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      'https://imperiodistribuidora3015.com.br';

    // Tenta extrair external_reference do body, query (?ref=) ou gera
    const refFromQS = req.nextUrl.searchParams.get('ref') || undefined;
    const external_reference =
      (bodyIn.external_reference || refFromQS || '').trim() || genExternalRef();

    const preference: MPPreferenceBody = {
      ...bodyIn,
      external_reference,
      notification_url: `${baseUrl}/api/webhook`,
      back_urls: {
        success: `${baseUrl}/pedidos?status=success&ref=${encodeURIComponent(external_reference)}`,
        failure: `${baseUrl}/pedidos?status=failure&ref=${encodeURIComponent(external_reference)}`,
        pending: `${baseUrl}/pedidos?status=pending&ref=${encodeURIComponent(external_reference)}`,
        ...(bodyIn.back_urls || {}),
      },
      metadata: {
        ...(bodyIn.metadata || {}),
        source: 'checkout-preference',
      },
    };

    const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
      cache: 'no-store',
    });

    const data = await mpResp.json().catch(() => ({}));
    if (!mpResp.ok) {
      return NextResponse.json(
        { ok: false, status: mpResp.status, preference: data },
        { status: 400 }
      );
    }

    const pref = data as { id?: string; init_point?: string; sandbox_init_point?: string };
    return NextResponse.json(
      {
        ok: true,
        preferenceId: pref.id,
        id: pref.id,
        init_point: pref.init_point || pref.sandbox_init_point,
        external_reference,
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
