'use client';

import { useEffect } from 'react';

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function ActionSheet({ open, title, subtitle, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white md:items-center md:justify-center md:bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel — full screen on mobile, centered card on desktop */}
      <div className="flex h-full w-full flex-col overflow-hidden bg-white md:h-auto md:max-h-[85vh] md:max-w-xl md:rounded-2xl md:shadow-2xl">

        {/* Sticky header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 leading-snug">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Κλείσιμο"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-2xl leading-none text-zinc-500 hover:bg-zinc-200 transition"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-10 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}
