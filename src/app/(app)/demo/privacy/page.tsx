'use client';

import Link from 'next/link';
import KnownLimitationsBox from '@/components/common/KnownLimitationsBox';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            Pilot / Internal
          </span>
          <Link href="/demo" className="text-xs text-zinc-400 hover:text-zinc-600">
            ← Demo οδηγός
          </Link>
        </div>
        <h1 className="text-xl font-bold text-zinc-900">Απόρρητο και αποθήκευση δεδομένων</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Απλή εξήγηση του πού αποθηκεύονται τα δεδομένα στο MVP και τι δεν συμβαίνει ακόμα.
        </p>
      </div>

      {/* Πού αποθηκεύονται τα δεδομένα */}
      <Section title="Πού αποθηκεύονται τα δεδομένα">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 space-y-3 text-sm text-zinc-700">
          <p>
            Το MVP αποθηκεύει <strong>όλα τα δεδομένα αποκλειστικά στον browser</strong> που
            χρησιμοποιείς, μέσω του <code className="rounded bg-zinc-100 px-1 text-xs">localStorage</code>.
          </p>
          <p>
            Δεν αποστέλλεται κανένα δεδομένο σε server ή cloud — εκτός από το κείμενο
            υπαγόρευσης που στέλνεις εσύ στο Claude AI (μόνο αν έχεις ρυθμίσει API key).
          </p>
          <p>
            Αν διαγράψεις τα cookies/localStorage ή αλλάξεις browser, τα δεδομένα
            <strong> χάνονται</strong> αν δεν έχεις κατεβάσει backup πρώτα.
          </p>
        </div>
      </Section>

      {/* Τι ΔΕΝ συμβαίνει */}
      <Section title="Τι ΔΕΝ συμβαίνει στο MVP">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 space-y-2">
          {[
            'Δεν υπάρχει cloud sync — τα δεδομένα είναι μόνο στον browser σου.',
            'Δεν γίνεται πραγματική κλήση ή ηχογράφηση.',
            'Δεν αποθηκεύεται ήχος ούτε transcript κλήσης (χωρίς VoIP provider).',
            'Δεν αποστέλλεται SMS ή email αυτόματα — γίνεται μόνο αντιγραφή κειμένου.',
            'Δεν γίνεται tracking χρήσης ή analytics.',
            'Δεν υπάρχουν λογαριασμοί χρηστών ή authentication.',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm text-zinc-600">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
              {item}
            </div>
          ))}
        </div>
      </Section>

      {/* Backup */}
      <Section title="Backup αρχείων">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 text-sm text-zinc-700 space-y-2">
          <p>
            Τα backup αρχεία JSON κατεβαίνουν <strong>απευθείας στον browser σου</strong>.
            Δεν ανεβαίνουν πουθενά αυτόματα.
          </p>
          <p>
            Κράτα τα backup σε ασφαλές μέρος — περιέχουν δεδομένα πελατών σου.
          </p>
        </div>
      </Section>

      {/* AI και API key */}
      <Section title="AI επεξεργασία">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 text-sm text-zinc-700 space-y-2">
          <p>
            Χωρίς API key: το AI review τρέχει σε demo λειτουργία χωρίς εξωτερική σύνδεση.
          </p>
          <p>
            Με API key: το κείμενο υπαγόρευσης αποστέλλεται στο Claude API (Anthropic)
            για ανάλυση. Δεν αποθηκεύεται ήχος — μόνο το κείμενο που πληκτρολογείς ή λαμβάνεις
            από τη speech recognition του browser.
          </p>
          <p>
            Η speech recognition γίνεται <strong>στον browser</strong> σου (Web Speech API) —
            δεν αποστέλλεται ήχος σε υπηρεσία yorgos.ai.
          </p>
        </div>
      </Section>

      {/* Τι χρειάζεται για production */}
      <Section title="Τι χρειάζεται πριν τη χρήση σε παραγωγή">
        <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 space-y-2 text-sm text-amber-800">
          <p className="font-semibold">Το MVP δεν είναι production-ready ως προς το GDPR/privacy:</p>
          <ul className="space-y-1">
            {[
              'Δεν υπάρχουν flows συγκατάθεσης (consent) για πελάτες.',
              'Δεν υπάρχει δικαίωμα διαγραφής δεδομένων από πελάτη.',
              'Δεν υπάρχει cloud backup με κρυπτογράφηση.',
              'Δεν έχει γίνει νομικός έλεγχος (GDPR compliance review).',
              'Απαιτείται αξιολόγηση από νομικό σύμβουλο πριν εμπορική χρήση.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-600" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs font-medium">
            Αυτή η σελίδα δεν αποτελεί νομική συμβουλή.
          </p>
        </div>
      </Section>

      <KnownLimitationsBox />

      <div className="flex flex-wrap gap-4">
        <Link href="/demo" className="text-sm text-indigo-600 hover:text-indigo-700">
          ← Demo οδηγός
        </Link>
        <Link href="/demo/production-readiness" className="text-sm text-zinc-500 hover:text-zinc-700">
          Τεχνική ετοιμότητα
        </Link>
        <Link href="/settings" className="text-sm text-zinc-500 hover:text-zinc-700">
          Ρυθμίσεις
        </Link>
      </div>
    </div>
  );
}
