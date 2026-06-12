// GET  /api/snippets        → list this business's message snippets (seeds defaults if empty)
// POST /api/snippets         → create a snippet { title, body }
//
// Snippets are reusable Greek text templates inserted into the customer chat
// composer with one tap. See src/lib/server/snippets.ts.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateBusinessRequest } from '@/lib/api/auth';
import { listSnippets } from '@/lib/server/snippets';

export const runtime = 'nodejs';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) {
    if (auth.error.status === 404) return NextResponse.json({ ok: true, snippets: [] });
    return auth.error;
  }
  const snippets = await listSnippets(auth.ctx.businessId);
  return NextResponse.json({ ok: true, snippets });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const title = str(raw.title);
  const text = str(raw.body);
  if (!title || !text) {
    return NextResponse.json({ ok: false, error: 'title_and_body_required' }, { status: 400 });
  }
  if (title.length > 80 || text.length > 1000) {
    return NextResponse.json({ ok: false, error: 'too_long' }, { status: 400 });
  }

  // Append at the end of the list.
  const { count } = await supabase
    .from('message_snippets')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);

  const { data, error } = await supabase
    .from('message_snippets')
    .insert({ business_id: businessId, title, body: text, sort_order: count ?? 0 })
    .select('id, title, body, sort_order')
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 500 });
  }
  const r = data as { id: string; title: string; body: string; sort_order: number };
  return NextResponse.json({ ok: true, snippet: { id: r.id, title: r.title, body: r.body, sortOrder: r.sort_order } });
}
