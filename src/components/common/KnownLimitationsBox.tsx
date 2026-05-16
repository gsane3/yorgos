const LIMITATIONS = [
  'Τοπική αποθήκευση μόνο — δεν υπάρχει cloud sync.',
  'Δεν γίνεται πραγματική κλήση ή ηχογράφηση.',
  'Δεν γίνεται πραγματική αποστολή SMS ή email.',
  'Δεν υπάρχει πραγματικός πάροχος VoIP, SMS ή email.',
  'Δεν έχει γίνει GDPR / legal compliance review.',
];

interface Props {
  compact?: boolean;
}

export default function KnownLimitationsBox({ compact = false }: Props) {
  return (
    <div className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200 space-y-1.5">
      <p className={`font-semibold text-zinc-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        Γνωστοί περιορισμοί MVP
      </p>
      <ul className="space-y-1">
        {LIMITATIONS.map((l) => (
          <li
            key={l}
            className={`flex items-start gap-2 text-zinc-500 ${compact ? 'text-[11px]' : 'text-xs'}`}
          >
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
