import type { YorgosMvpState } from './types';

const STORAGE_KEY = 'yorgos_ai_mvp_state';

export function loadState(): YorgosMvpState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as YorgosMvpState) : {};
  } catch {
    return {};
  }
}

export function saveState(partial: Partial<YorgosMvpState>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
  } catch {
    // localStorage unavailable
  }
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
