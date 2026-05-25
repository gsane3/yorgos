'use client';

import { useState } from 'react';

export default function QuickAssistantInput() {
  const [text, setText] = useState('');

  return (
    <div className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-zinc-200/60">
      <p className="text-sm font-medium text-zinc-700">Τι θέλεις να οργανώσω;</p>

      <div className="mt-3 flex items-center gap-2">
        {/* Mic stub */}
        <button
          disabled
          title="Φωνητική υπαγόρευση, σύντομα"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 cursor-not-allowed"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            strokeWidth={1.5}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
            />
          </svg>
        </button>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='π.χ. "Φτιάξε προσφορά στον Καραγιάννη"'
          className="flex-1 rounded-2xl border-0 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none ring-1 ring-zinc-200/70 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition"
        />

        {/* Submit stub */}
        <button
          disabled
          title="Σύντομα διαθέσιμο"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white opacity-50 cursor-not-allowed"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            strokeWidth={2}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
