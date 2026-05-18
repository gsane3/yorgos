# yorgos.ai Build Prompt

Use this prompt for the future coding agent.

## Scope

This prompt applies to the yorgos.ai localStorage MVP phase only.

The constraints in this document, including no database, mock auth, and local storage only, are correct for MVP coding agents building the initial prototype.

For backend v2 implementation, see `BACKEND_SPEC.md` at the project root. That document is the approved backend direction and supersedes the database and auth constraints below for v2 work.

## Role

You are building yorgos.ai, a mobile-first AI assistant for Greek professionals who work on the road and need help turning calls and voice commands into CRM updates, tasks, offer drafts and communication drafts.

Build step by step. Do not overbuild.

## Product rules

- Documentation first.
- Mobile-first responsive web app/PWA.
- Desktop/browser compatible.
- Greek-only UI for MVP.
- The app is assistant-first, not CRM-first.
- The user chooses profession/business type during onboarding.
- Profession affects AI tone, tasks, summaries and offer drafts.
- No hidden call recording.
- Call recording is a core future selling point, but real recording is not built in MVP.
- Mock calls must be labelled as mock/demo.
- Real AI processing is required through a backend/API proxy.
- Real speech-to-text should be attempted in browser for Greek.
- Manual text fallback is required.
- No automatic save from AI.
- Every AI result must show review screen before save.
- No automatic sending of offers or messages.
- Viber/email drafts are copied manually.
- PDF-style offer preview only in MVP.
- Local storage only for app data.
- Mock auth only.
- Mock workspace/team only.
- Mock CRM import only.
- No database unless explicitly approved.
- No real integrations unless explicitly approved.

## Tech stack

Preferred stack:

- Next.js
- TypeScript
- Tailwind CSS
- Component-based UI
- Local storage for MVP data
- API route for AI proxy
- Browser SpeechRecognition or compatible fallback

If the existing project already has a stack, follow it unless it conflicts with these rules.

## File structure suggestion

Suggested structure:

```text
app/
  login/
  onboarding/
  dashboard/
  customers/
  customers/[id]/
  tasks/
  offers/
  offers/[id]/
  call/mock/
  ai-review/
  settings/
  api/ai/process/
components/
  layout/
  dashboard/
  customers/
  tasks/
  offers/
  calls/
  ai/
  settings/
lib/
  storage.ts
  types.ts
  demo-data.ts
  search.ts
  ai-schema.ts
  offer-calculations.ts
  maps.ts
  text-normalization.ts
```

Adjust to the existing project structure if needed.

## Data model

Use the data model from `docs/04_DATA_MODEL.md`.

Core entities:

- UserProfile
- BusinessProfile
- Workspace, mock only
- Customer
- CustomerSummary
- CallRecord
- DictationCommand
- AiResult
- Task
- Offer
- OfferItem
- CommunicationDraft
- MissedCall

Use local storage namespace:

yorgos_ai_mvp_state

## Build sequence

### Step 1, App shell and mock onboarding

Build:

- Mock login/register
- Onboarding
- Business type selection
- Business profile form
- Logo preview
- Default VAT
- Default offer terms
- App shell
- Mobile bottom nav
- Floating + New Action

Do not build AI yet.

Validate:

- Mobile layout
- Desktop layout
- Local storage save/load

### Step 2, Dashboard and demo data

Build:

- Dashboard
- Missed calls section
- Leads waiting to call
- Today tasks
- Open offers
- Recent calls
- Demo data

Validate:

- Dashboard explains value in under 30 seconds
- Missed calls are visually urgent
- Leads and tasks are clear

### Step 3, CRM

Build:

- Customer list
- Customer cards
- Customer profile
- Manual customer/lead creation
- Source
- Opportunity value
- Status
- Preferred communication method
- Open in Google Maps link

Validate:

- Customer can be created, viewed and edited locally
- Maps link opens correctly

### Step 4, Tasks

Build:

- Tasks page
- Today view
- Upcoming/overdue/completed filters
- Task creation/editing
- Task completion

Validate:

- Task date and time work
- Customer relationship works

### Step 5, Offers

Build:

- Offers list
- Offer editor
- Offer line items
- VAT calculation
- Offer statuses
- PDF-style preview
- Copy Viber draft
- Copy email draft

Validate:

- Totals calculate correctly
- Preview looks clean on mobile and desktop
- Copy actions work

### Step 6, Mock call flow

Build:

- Call type selector
- Mock call screen
- Mock recording indicator
- Duration timer
- End call action
- Demo transcript/scenario selection

Validate:

- Mock labels are clear
- Flow leads to AI review placeholder

### Step 7, AI review screen

Build:

- AI review screen UI
- Editable sections
- Customer section
- Summary section
- Needs section
- Tasks section
- Offer section
- Status update
- Warnings
- Save action
- Success screen with quick actions

Validate:

- Nothing saves before review
- User can edit proposed output
- Save updates local CRM/tasks/offers

### Step 8, AI API proxy

Build:

- Backend/API route for AI processing
- Structured input payload
- Structured JSON output
- Error handling
- Prompt context includes business type and business settings

Do not expose API key in frontend.

AI route should handle:

- dictation command
- demo call transcript

Output structure should include:

- intent
- customer
- summary
- customerNeeds
- tasks
- offer
- statusUpdate
- messages
- nextBestAction
- warnings

Validate:

- API route returns valid structured JSON
- UI handles errors
- UI handles missing fields

### Step 9, Speech-to-text

Build:

- Microphone button
- Browser speech-to-text for Greek if supported
- Permission handling
- Manual text fallback
- Submit text to AI processing

Validate:

- Works where supported
- Fallback is obvious where unsupported
- No raw audio is stored

### Step 10, Search and filters

Build:

- CRM search
- Accent-insensitive normalization
- Case-insensitive matching
- Basic greeklish matching
- Basic fuzzy matching
- Filters by status, source, open task and open offer

Validate:

- Greek names with and without accents work
- Greeklish approximations work
- Phone search works

### Step 11, Settings and mock import

Build:

- Business settings
- Logo settings
- VAT settings
- Offer terms
- Communication defaults
- Mock workspace panel
- Mock CRM import panel

Validate:

- Settings update offer preview
- Import is clearly labelled as coming soon/mock

## AI prompt rules

The AI should return structured JSON only.

The AI should write in Greek.

The AI should adapt tone and tasks based on business type.

The AI should be practical and concise.

The AI should warn when uncertain.

The AI should not claim that an offer was sent.

The AI should not create legal claims.

The AI should not store or return unnecessary transcript text.

## Example AI input

```json
{
  "sourceType": "dictation",
  "businessType": "technical_services",
  "businessProfile": {
    "businessName": "Demo Business",
    "defaultVatRate": 24
  },
  "existingCustomers": [],
  "inputText": "Φτιάξε προσφορά στον Καραγιάννη με 100 ευρώ εργασία και 50 ευρώ υλικά"
}
```

## Example AI output

```json
{
  "intent": "create_offer",
  "customer": {
    "name": "Καραγιάννης",
    "preferredContactMethod": "viber"
  },
  "summary": "Ο χρήστης ζήτησε να δημιουργηθεί προσφορά για τον Καραγιάννη.",
  "customerNeeds": "Χρειάζεται προσφορά για εργασία και υλικά.",
  "tasks": [
    {
      "title": "Έλεγχος και αποστολή προσφοράς στον Καραγιάννη",
      "type": "send_offer",
      "dueDate": "",
      "dueTime": "",
      "priority": "normal",
      "note": "Να ελεγχθούν τα ποσά πριν σταλεί."
    }
  ],
  "offer": {
    "shouldCreate": true,
    "items": [
      {
        "description": "Εργασία",
        "quantity": 1,
        "unitPrice": 100
      },
      {
        "description": "Υλικά",
        "quantity": 1,
        "unitPrice": 50
      }
    ],
    "notes": "Οι τιμές δεν περιλαμβάνουν αλλαγές εκτός συμφωνημένου αντικειμένου.",
    "terms": "Η προσφορά ισχύει για περιορισμένο χρονικό διάστημα."
  },
  "statusUpdate": "offer_drafted",
  "messages": {
    "viber": "Καλησπέρα κύριε Καραγιάννη, σας ετοίμασα την προσφορά όπως συζητήσαμε. Είμαι στη διάθεσή σας για οποιαδήποτε διευκρίνιση.",
    "emailSubject": "Προσφορά",
    "emailBody": "Καλησπέρα κύριε Καραγιάννη,\n\nΣας στέλνω την προσφορά όπως συζητήσαμε.\n\nΕίμαι στη διάθεσή σας για οποιαδήποτε διευκρίνιση.\n\nΜε εκτίμηση,"
  },
  "nextBestAction": "Έλεγξε την προσφορά και στείλε την στον πελάτη.",
  "warnings": [
    "Χρειάζεται επιβεβαίωση αν οι τιμές περιλαμβάνουν ΦΠΑ."
  ]
}
```

## Privacy rules for implementation

- Do not store raw audio.
- Do not store full transcript as CRM record.
- Store only user-approved summary and structured data.
- Mock calls must show clear demo label.
- Do not claim GDPR compliance.
- Add privacy copy where relevant.
- User must be able to delete local customer/task/offer data.

## Validation commands

Run after every coding task:

```bash
npm run lint
npm run build
```

Return to user after each task:

- Files changed
- What changed
- Manual review URLs/pages
- What is mock/local
- Confirm lint/build clean

## Git rules

Before commit:

```bash
git status
```

Add only relevant files.

Never commit:

- `.env`
- `.env.local`
- API keys
- unrelated local settings
- unrelated generated files

Suggested commit format:

```bash
git add <relevant files>
git commit -m "Add <small focused change>"
```

Keep commits small and related to one build step.

## Build discipline

Do not build future features early.

Do not add database.

Do not add auth.

Do not add real VoIP.

Do not add real integrations.

Do not add PDF export unless explicitly approved.

Do not add real team sharing unless explicitly approved.

Always separate:

- Real
- Mock/local
- Future
