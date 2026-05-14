'use client';

interface Props {
  vatRate: number;
  offerTerms: string;
  onChangeVat: (rate: number) => void;
  onChangeTerms: (terms: string) => void;
}

export default function VatAndTermsForm({
  vatRate,
  offerTerms,
  onChangeVat,
  onChangeTerms,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-zinc-500">
        Αυτές οι ρυθμίσεις θα εφαρμόζονται σε όλες τις νέες προσφορές. Μπορείς
        να τις αλλάξεις αργότερα από τις Ρυθμίσεις.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Προεπιλεγμένο ΦΠΑ
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={vatRate}
            onChange={(e) => onChangeVat(Number(e.target.value))}
            className="w-24 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <span className="text-sm font-medium text-zinc-600">%</span>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Το συνηθισμένο ΦΠΑ για επαγγελματικές υπηρεσίες στην Ελλάδα είναι 24%.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Προεπιλεγμένοι όροι προσφοράς
        </label>
        <textarea
          rows={4}
          value={offerTerms}
          onChange={(e) => onChangeTerms(e.target.value)}
          placeholder="π.χ. Η παρούσα προσφορά ισχύει για 30 ημέρες από την ημερομηνία έκδοσης."
          className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Θα εμφανίζεται στο κάτω μέρος των προσφορών σου.
        </p>
      </div>
    </div>
  );
}
