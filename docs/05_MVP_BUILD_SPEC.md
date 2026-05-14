# yorgos.ai MVP Build Spec

## Goal

Build a mobile-first responsive web app/PWA prototype that demonstrates the main product loop:

Conversation or command → AI review → CRM/tasks/offer → quick action

The MVP should feel real enough to test with potential users, but it must clearly separate real functionality from mock functionality.

## Required stack direction

Preferred stack:

- Next.js with TypeScript
- Tailwind CSS
- Component-based UI
- Local storage state
- API route for AI processing
- Browser speech-to-text where supported
- Text fallback

If the existing project uses another React-based setup, follow the existing stack unless it conflicts with the product rules.

## App routes/screens

### Required routes

- `/login` or initial mock auth screen
- `/onboarding`
- `/app` or `/dashboard`
- `/customers`
- `/customers/[id]`
- `/tasks`
- `/offers`
- `/offers/[id]`
- `/call/mock`
- `/ai-review`
- `/settings`

Route names can be adapted to the existing project, but the user-facing navigation should remain Greek.

## Main navigation

Mobile bottom nav:

- Αρχική
- Πελάτες
- Tasks
- Προσφορές

Floating action button:

+ New Action

Action menu:

- Νέα κλήση
- Υπαγόρευση
- Νέος πελάτης
- Νέα προσφορά

## Components to build

### Shell/navigation

- App shell
- Mobile bottom nav
- Desktop layout
- Floating action button
- Action sheet/menu

### Onboarding

- Business type selector
- Business profile form
- Logo preview upload
- VAT setting
- Offer terms field

### Dashboard

- MissedCallsSection
- LeadsWaitingSection
- TodayTasksSection
- OpenOffersSection
- RecentCallsSection
- QuickAssistantInput

### CRM

- CustomerList
- CustomerCard
- CustomerSearch
- CustomerFilters
- CustomerProfile
- CustomerQuickActions
- CustomerStatusBadge

### Tasks

- TaskList
- TaskCard
- TaskStatusBadge
- TaskEditor
- TodayView

### Offers

- OfferList
- OfferCard
- OfferStatusBadge
- OfferEditor
- OfferPreview
- OfferLineItems
- CopyDraftActions

### Calls

- CallTypeSelector
- MockCallScreen
- RecordingIndicator
- DemoTranscriptSelector or scenario selector
- EndCallAction

### AI

- DictationButton
- SpeechToTextInput
- ManualTextFallback
- AiProcessingState
- AiReviewScreen
- AiWarningBadge
- SaveAiResultAction

### Settings

- BusinessSettings
- LogoSettings
- OfferSettings
- CommunicationSettings
- MockWorkspacePanel
- MockCrmImportPanel

## What must work

### 1. Mock onboarding

User can enter business info and select profession/business type.

Data saves locally.

Business type affects AI prompt context and demo labels.

### 2. Local CRM

User can view customers.

User can create customer manually.

User can open customer profile.

User can edit basic customer fields.

### 3. Dashboard

Dashboard shows:

- Mock missed calls
- Leads waiting to call
- Today tasks
- Open offers
- Recent calls

### 4. Missed calls

Mock missed calls appear.

Each missed call creates or shows a Call back task.

Unknown number can be converted to customer.

### 5. Mock call flow

User can start mock call from customer or lead.

User selects call type.

Mock call screen shows duration and demo recording indicator.

User ends call.

App sends demo transcript to AI processing.

AI review screen appears.

User edits and saves.

CRM/tasks/offers update locally.

### 6. Dictation

User can press microphone.

If supported, browser speech-to-text captures Greek speech.

If not supported or permission fails, user can type manually.

Text is sent to AI processing.

AI review screen appears.

User edits and saves.

### 7. AI API proxy

Frontend must not expose AI API key.

Use backend/API route for AI processing.

The API should return structured JSON for:

- customer update
- summary
- needs
- tasks
- offer
- status update
- messages
- warnings

If AI fails, show clear error and allow manual entry.

### 8. AI review

AI output must never save automatically.

User can edit proposed data before saving.

Warnings must appear when confidence is low or data is missing.

### 9. Offers

User can create offer draft.

Offer includes line items, VAT and total.

Offer can be previewed in PDF-style layout.

User can copy Viber message.

User can copy email draft.

User can manually change status.

### 10. Search and filters

CRM search should work locally.

Minimum expected:

- lowercase/uppercase insensitive
- accent insensitive
- search by name, phone, email, company, address, notes
- basic greeklish matching
- basic fuzzy tolerance

Filters:

- status
- source
- open task
- open offer

### 11. Google Maps link

Customer address opens Google Maps using a URL.

No Maps API needed.

### 12. Settings

User can edit business details, logo preview, VAT and offer terms.

CRM import panel appears as mock/coming soon.

Workspace/team appears as mock only.

## What can be mock/local

- Auth
- User account
- Workspace/team
- CRM data
- Calls
- Missed calls
- Call recordings
- Demo transcripts
- CRM import
- Ads lead import
- Email sending
- Viber sending
- PDF export

## What must be real

- Greek UI flow
- Local data persistence
- Real AI API processing through backend route
- Real browser speech-to-text attempt
- Manual text fallback
- Review before save
- Offer calculations
- Copy-to-clipboard for drafts
- Google Maps link

## Privacy-safe acceptance criteria

- No hidden recording language.
- Mock calls are clearly labelled as demo/mock.
- Raw audio is not stored.
- Full transcript is not stored as final CRM data.
- AI result is saved only after user review.
- User can delete customer, task, offer or note data.
- The app does not claim GDPR compliance.
- The app states that final legal compliance requires legal review before production launch.

## AI structured output suggestion

The API route should return a stable structure similar to:

```json
{
  "intent": "create_offer",
  "customer": {
    "name": "",
    "phone": "",
    "email": "",
    "address": "",
    "source": "",
    "opportunityValue": 0,
    "preferredContactMethod": "viber"
  },
  "summary": "",
  "customerNeeds": "",
  "tasks": [
    {
      "title": "",
      "type": "call_back",
      "dueDate": "",
      "dueTime": "",
      "priority": "normal",
      "note": ""
    }
  ],
  "offer": {
    "shouldCreate": false,
    "items": [
      {
        "description": "",
        "quantity": 1,
        "unitPrice": 0
      }
    ],
    "notes": "",
    "terms": ""
  },
  "statusUpdate": "follow_up_needed",
  "messages": {
    "viber": "",
    "emailSubject": "",
    "emailBody": ""
  },
  "nextBestAction": "",
  "warnings": []
}
```

## Manual review URLs/pages

After each build step, manually review:

- Login/onboarding
- Dashboard mobile width
- Dashboard desktop width
- Customers list
- Customer profile
- Tasks
- Offers
- Offer preview
- Mock call flow
- AI review screen
- Settings

## Validation commands

Always run:

```bash
npm run lint
npm run build
```

## Git rules

Keep commits small.

Commit only relevant files.

Do not commit local env files.

Do not commit unrelated local settings.

Do not commit API keys.

Suggested commit messages:

- `Add yorgos.ai app shell and onboarding`
- `Add local CRM and dashboard views`
- `Add mock call flow and AI review screen`
- `Add offers preview and communication drafts`
