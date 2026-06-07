// Server-only helpers for team-invite tokens. The raw token lives only in the
// /join/<token> link we hand to the owner; the DB stores its SHA-256 hash.

import crypto from 'node:crypto';

export function generateInviteToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('base64url');
  const hash = hashInviteToken(raw);
  return { raw, hash };
}

export function hashInviteToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function buildJoinUrl(rawToken: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://opiflow.vercel.app').replace(/\/$/, '');
  return `${base}/join/${rawToken}`;
}

export function isManager(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}
