// Server-only helpers for message snippets (reusable Greek text templates).
//
// Snippets cut the most repeated daily action for a tradesman: re-typing the
// same Viber/SMS replies. A business's snippets live in `message_snippets`
// (migration 044); on first read for a business with none, we lazily seed a
// small trade-default set so the feature is useful on day one without a
// per-business migration.
//
// Merge tokens (filled client- or server-side at send time):
//   {όνομα}        → customer name
//   {ημερομηνία}   → appointment date (when known)
//   {ώρα}          → appointment time (when known)
//   {διεύθυνση}    → customer address

import { createServiceSupabaseClient } from './intake-tokens';

export interface Snippet {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
}

/** Trade-default snippets seeded for a business that has none yet. */
export const DEFAULT_SNIPPETS: Array<{ title: string; body: string }> = [
  { title: 'Ερχόμαστε σύντομα', body: 'Γεια σας {όνομα}, ερχόμαστε σε περίπου 30 λεπτά.' },
  { title: 'Στείλτε φωτογραφία', body: 'Καλησπέρα {όνομα}, μπορείτε να μας στείλετε μια φωτογραφία της βλάβης για να την δούμε;' },
  { title: 'Επιβεβαίωση ραντεβού', body: 'Το ραντεβού σας επιβεβαιώθηκε για {ημερομηνία} στις {ώρα}. Θα σας περιμένουμε!' },
  { title: 'Καθυστέρηση', body: 'Γεια σας {όνομα}, θα καθυστερήσουμε λίγο. Θα είμαστε εκεί το συντομότερο δυνατό.' },
  { title: 'Ολοκλήρωση εργασίας', body: 'Η εργασία ολοκληρώθηκε. Ευχαριστούμε για την εμπιστοσύνη! Για οτιδήποτε χρειαστείτε, είμαστε στη διάθεσή σας.' },
  { title: 'Ευχαριστούμε', body: 'Σας ευχαριστούμε που μας προτιμήσατε, {όνομα}! Καλή συνέχεια.' },
  { title: 'Διεύθυνση', body: 'Μπορείτε να μας στείλετε την ακριβή διεύθυνση και έναν όροφο/κουδούνι;' },
  { title: 'Θα σας καλέσουμε', body: 'Λάβαμε το μήνυμά σας {όνομα}, θα σας καλέσουμε σύντομα να τα πούμε.' },
];

type SupabaseService = ReturnType<typeof createServiceSupabaseClient>;

interface SnippetRow {
  id: string;
  title: string;
  body: string;
  sort_order: number;
}

function rowToSnippet(r: SnippetRow): Snippet {
  return { id: r.id, title: r.title, body: r.body, sortOrder: r.sort_order };
}

/**
 * List a business's snippets, seeding the trade defaults the first time a
 * business has none. Best-effort: returns [] on any failure (e.g. migration 044
 * not yet applied) so the feature degrades to "no snippets" rather than erroring.
 */
export async function listSnippets(businessId: string): Promise<Snippet[]> {
  let supabase: SupabaseService;
  try {
    supabase = createServiceSupabaseClient();
  } catch {
    return [];
  }

  const { data, error } = await supabase
    .from('message_snippets')
    .select('id, title, body, sort_order')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return []; // table missing (pre-044) → degrade gracefully

  const rows = (data ?? []) as unknown as SnippetRow[];
  if (rows.length > 0) return rows.map(rowToSnippet);

  // Empty → seed the defaults once, then return them.
  const seedRows = DEFAULT_SNIPPETS.map((s, i) => ({
    business_id: businessId,
    title: s.title,
    body: s.body,
    sort_order: i,
  }));
  const { data: seeded, error: seedErr } = await supabase
    .from('message_snippets')
    .insert(seedRows)
    .select('id, title, body, sort_order');

  if (seedErr || !seeded) {
    // Could not persist (e.g. race) — still surface defaults in-memory so the
    // UI is useful; ids are synthetic and won't be editable until a real row exists.
    return DEFAULT_SNIPPETS.map((s, i) => ({ id: `default-${i}`, title: s.title, body: s.body, sortOrder: i }));
  }
  return (seeded as unknown as SnippetRow[]).map(rowToSnippet);
}

/**
 * Fill merge tokens in a snippet body. All tokens are optional; unknown values
 * collapse to an empty string and the surrounding text is tidied.
 */
export function fillSnippet(
  body: string,
  vars: { name?: string | null; date?: string | null; time?: string | null; address?: string | null }
): string {
  return body
    .replace(/\{όνομα\}/g, vars.name?.trim() || '')
    .replace(/\{ημερομηνία\}/g, vars.date?.trim() || '')
    .replace(/\{ώρα\}/g, vars.time?.trim() || '')
    .replace(/\{διεύθυνση\}/g, vars.address?.trim() || '')
    // Tidy double spaces / dangling punctuation left by empty tokens.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.!;])/g, '$1')
    .trim();
}
