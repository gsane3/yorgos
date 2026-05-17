export default async function AppointmentResponsePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="mx-auto max-w-lg space-y-6 px-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 space-y-4">
          <div className="rounded-xl bg-amber-50 px-4 py-2.5 ring-1 ring-amber-200 text-center">
            <p className="text-xs font-medium text-amber-700">
              Demo μόνο. Τα δεδομένα αποθηκεύονται τοπικά στον browser και δεν έχει συνδεθεί πραγματικό ημερολόγιο.
            </p>
          </div>

          <h1 className="text-xl font-bold text-zinc-900">Απάντηση ραντεβού</h1>

          <p className="text-sm text-zinc-600">
            Εδώ θα μπορεί ο πελάτης να αποδεχτεί το προτεινόμενο ραντεβού ή να προτείνει άλλη ώρα.
          </p>

          <p className="text-xs text-zinc-400">
            Η λειτουργικότητα αυτής της σελίδας θα προστεθεί στο επόμενο βήμα.
          </p>

          <p className="text-[10px] text-zinc-300 font-mono break-all">
            id: {id}
          </p>
        </div>

        <p className="text-center text-xs text-zinc-400">
          yorgos.ai MVP, τοπική αποθήκευση μόνο
        </p>
      </div>
    </div>
  );
}
