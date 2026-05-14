# yorgos.ai User Flows

## 1. First entry flow

User opens app → sees mock login/register → enters basic info → continues to onboarding → chooses business type → enters business details → uploads logo preview → sets VAT and offer terms → lands on dashboard

## 2. Business type setup flow

User chooses profession → app stores business mode locally → AI tone and suggestions adapt to that mode → tasks, summaries and offer drafts use that context

Business modes:

- Technical services
- Sales / services
- Projects / construction
- Other

## 3. Dashboard daily flow

User opens app → sees missed calls first → sees leads waiting to call → sees today tasks → sees open offers → chooses next action

## 4. New manual lead flow

User taps + New Action → selects New lead → enters name, phone, email, address, source, opportunity value and note → saves → lead appears in CRM and Leads waiting to call

## 5. Leads waiting to call flow

User opens dashboard → sees Leads waiting to call → taps a lead → sees quick actions → taps Call → mock call setup opens

## 6. Missed call flow

Mock missed call appears → app creates Call back task automatically → missed call appears at top of dashboard → user taps Call back or Add to CRM → if number is unknown, user can convert it to customer → user can mark missed call as handled

## 7. Unknown lead from call flow

Unknown number appears → user opens missed call → user taps Add to CRM → customer form opens with phone prefilled → user adds missing details → saves → customer is created with source Missed call

Future ideal:

Customer states name, email and address during recorded call → AI extracts details → review screen pre-fills customer profile → user confirms → customer is created or updated

## 8. Mock call type selection flow

User taps Call → selects call type → chooses scenario if needed → mock call screen opens

Call types:

- Inbound from new customer
- Inbound from existing customer
- Outbound to new lead
- Outbound to existing customer

## 9. Mock call recording flow

User starts mock call → call screen shows customer, duration and demo recording indicator → user taps End call → app loads demo transcript → AI API processes transcript → review screen opens → user edits result → user saves → success screen appears

## 10. AI review after call flow

AI result appears → user reviews customer info → user reviews summary → user reviews needs → user reviews tasks → user reviews offer if created → user reviews status update → user checks warnings → user edits fields if needed → user taps Save → CRM is updated locally

## 11. Dictation flow

User taps microphone → speaks in Greek → browser speech-to-text creates text → if speech-to-text fails, user types manually → user submits → AI API detects intent → review screen opens → user edits → user saves

Example intents:

- Create CRM note
- Create task
- Create offer
- Update customer
- Change status
- Create follow-up message

## 12. Dictation offer flow

User taps microphone → says “Φτιάξε προσφορά στον Καραγιάννη με 100 ευρώ εργασία και 50 ευρώ υλικά” → speech-to-text creates command → AI extracts customer and line items → review screen shows offer draft → user edits if needed → user saves → offer appears in Offers page with status Draft or Ready to send

## 13. Offer preview flow

User opens offer → taps Preview → PDF-style preview opens → user checks business details, customer details, line items, VAT and total → user can copy Viber message or email draft → user manually sends outside the app → user can mark offer as Sent manually

## 14. Viber draft flow

User opens customer, task or offer → taps Copy Viber message → app creates short professional Greek message → message is copied → user opens Viber manually and sends

## 15. Email draft flow

User opens customer, task or offer → taps Copy email draft → app creates professional Greek email text → user copies → user sends manually from email client

## 16. Offer status flow

Offer starts as Draft → user reviews → user marks Ready to send → user copies/sends manually → user marks Sent manually → later user marks Accepted, Rejected or Expired

Statuses:

- Draft
- Ready to send
- Sent manually
- Accepted
- Rejected
- Expired

## 17. Task creation from AI flow

AI detects next actions → review screen shows proposed tasks → user edits date/time/type/priority → user saves → tasks appear in Tasks page and customer profile

## 18. Task completion flow

User opens Tasks → selects task → sees customer context → performs action → marks completed → status updates locally → customer profile updates

## 19. Next best action flow

AI result includes suggested next best action → user sees it in review screen and customer profile → user can create task from it or dismiss it

Example:

Πρότεινε να καλέσεις αύριο στις 11:00 γιατί ο πελάτης ζήτησε χρόνο να το σκεφτεί.

## 20. Customer profile flow

User opens customer → sees contact details, source, value, status and preferred communication method → sees next best action → sees open tasks → sees offers → sees conversation summaries → uses quick actions

Quick actions:

- Call
- Open in Maps
- Create task
- Create offer
- Copy Viber draft
- Copy email draft

## 21. Google Maps flow

User opens customer profile → customer has address → user taps Open in Maps → app opens Google Maps search URL using the address

No real Google Maps API is needed in MVP.

## 22. Search and filter flow

User opens CRM → types name, phone, greeklish, email, address, source or note → app normalizes text → app returns relevant customers → user can filter by status, source, open task or open offer

Search should handle:

- Accents
- Case
- Greeklish basic matching
- Small typos
- Phone numbers

## 23. Settings flow

User opens Settings → edits business details, logo preview, VAT, offer terms and communication defaults → app saves locally → new offers use updated settings

## 24. Mock CRM import flow

User opens Settings → sees Import CRM → taps Upload XLS/CSV → app shows placeholder or coming soon message → no real import is performed in MVP

## 25. Workspace mock flow

User opens Settings → sees Workspace: My Business → sees future team sharing hint → no real sharing, roles or invites in MVP

## 26. Future real VoIP flow

User buys or connects yorgos.ai VoIP number → calls pass through VoIP partner → before recording, customer hears clear notice or consent message → call is recorded → transcription happens → raw audio is deleted or handled according to settings → AI creates summary, tasks and offers → user reviews → saves

## 27. Future real-time objection coaching flow

User is in VoIP call → audio stream is transcribed live → AI detects objection → app shows suggested response in side panel → user decides what to say → suggestions are not sent to customer automatically
