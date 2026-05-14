# yorgos.ai Product Spec

## Product summary

yorgos.ai is a mobile-first AI assistant for professionals in Greece. It helps users handle calls, missed calls, leads, CRM notes, follow-ups and offers without heavy manual admin.

The MVP should prove one main idea:

A professional can speak naturally in Greek, or finish a customer call, and yorgos.ai creates the useful business output: CRM summary, tasks, next best action, offer draft and Viber/email draft.

## Product pillars

### 1. Assistant-first, not CRM-first

The product should feel like a personal assistant, not like software admin.

The user should think:

What do I need to do now?

Not:

I need to update my CRM.

### 2. Mobile-first for professionals on the road

The main use case is mobile. The user may be driving, walking between jobs or talking to customers.

The UI must be fast, clear and usable from a phone.

### 3. Calls and conversations become business actions

The app turns conversations into structured action:

- CRM summary
- Customer needs
- Follow-up tasks
- Next best action
- Offer draft
- Communication draft

### 4. Review before save

AI never writes final CRM data automatically. The user reviews and edits everything before saving.

### 5. Consent-first recording architecture

Call recording is a core future selling point, but it must be designed with clear notice and consent.

No hidden recording.

### 6. Generic product with profession-specific setup

The MVP should not be locked to one industry, but it should not be vague.

The user chooses a profession/business type during onboarding. The app adapts tone, task suggestions and offer drafts accordingly.

## MVP scope

### Real in MVP

- Greek UI
- Mock login/register
- Onboarding with business type selection
- Business profile settings
- Logo preview upload
- Local storage for CRM/tasks/offers/settings
- Dashboard
- CRM list
- Customer profile
- Manual lead creation
- Missed calls section, mocked
- Leads waiting to call
- Tasks page
- Offers page
- Mock app call screen
- Mock recording indicator
- Demo call transcripts
- AI review screen
- Real AI API processing through backend/API route
- Real speech-to-text for Greek where browser supports it
- Manual text fallback
- PDF-style offer preview
- Copy Viber message
- Copy email draft
- Google Maps open link
- Search/filter with Greek-friendly normalization
- Mock workspace/team indicator
- Mock CRM import placeholder

### Mock in MVP

- Real VoIP number purchase
- Real call recording
- Real inbound calls
- Real outbound telecom calls
- Real call log from carrier phone
- Real Viber integration
- Real email sending
- Real PDF export/download
- Real CRM import parser
- Google Ads import
- Meta Ads import
- Real teams and sharing
- Calendar integration
- Invoicing integration

### Explicit non-goals for MVP

- No hidden call recording
- No native iOS/Android app
- No real authentication
- No database
- No user roles
- No paid billing
- No production legal compliance claims
- No automatic sending of offers
- No automatic CRM save without user review

## Post-MVP scope

### MVP 2

- Real VoIP partner integration
- Buy or connect a business number
- Real in-app calling through VoIP
- Consent notice before recording
- Real call recording
- Real transcription
- Real yorgos.ai call log
- Improved AI call summaries

### MVP 3

- Google Ads lead import
- Meta Ads lead import
- Website form lead import
- Real CRM import from XLS/CSV
- Email integration
- Calendar integration
- Invoicing integration
- Real PDF export
- Team sharing
- Roles and permissions
- Database and auth

### Later

- Real-time sales objection coaching
- Live call transcription
- AI suggested replies during calls
- Advanced pipeline analytics
- Mobile native apps if validated

## Key features

### Dashboard

Assistant-focused home page.

Sections:

- Urgent missed calls
- Leads waiting to call
- Today tasks
- Open offers
- Recent calls
- Quick actions

### CRM

Customer list with:

- Name
- Status
- Source
- Opportunity value
- Next task
- Last communication

Customer profile with:

- Basic info
- Source
- Opportunity value
- Preferred communication method
- Status
- Customer needs
- Call history summary
- Tasks
- Offers
- Notes
- Google Maps action

### Tasks

Tasks include:

- Title
- Customer
- Date
- Time
- Priority
- Type
- Status
- Related call/customer/offer
- Note

Task types:

- Call back
- Send offer
- Follow up offer
- Ask for photos/documents
- Book appointment
- Visit customer
- Wait for reply
- Other

Statuses:

- Open
- Due today
- Overdue
- Completed
- Cancelled

### Offers

Offer statuses:

- Draft
- Ready to send
- Sent manually
- Accepted
- Rejected
- Expired

Offer fields:

- Customer
- Related task
- Offer number
- Offer date
- Valid until
- Line items
- Quantity
- Unit price
- Net amount
- VAT 24 percent by default
- Total
- Notes
- Terms
- Acceptance text

### AI review

Every AI result must show a review screen before save.

Sections:

- Customer
- Summary
- Customer needs
- Tasks
- Offer, if relevant
- Status update
- Warnings needing confirmation

Full transcript is not stored. Only final result and summary are stored after approval.

### Dictation

The user presses microphone and speaks in Greek.

Examples:

- Κράτα σημείωση ότι ο Παπαδόπουλος θέλει ραντεβού την Παρασκευή.
- Θύμισέ μου να καλέσω τον Καραγιάννη αύριο στις 11.
- Φτιάξε προσφορά 100 ευρώ εργασία και 50 ευρώ υλικά στον Καραγιάννη.
- Βάλε στον Δημητρίου ότι ήρθε από Facebook και η αξία είναι περίπου 800 ευρώ.

The app detects intent and prepares the right result for review.

### Mock call flow

The user chooses call type:

- Inbound from new customer
- Inbound from existing customer
- Outbound to new lead
- Outbound to existing customer

Then:

Customer → Call → mocked call screen → End call → demo transcript → AI processing → Review → Save → success screen with quick actions

## Success metrics for testing

The first MVP should be judged by whether target users understand the value quickly.

Suggested validation metrics:

- Can a user understand the product within 30 seconds?
- Can a user create a CRM update from dictation without help?
- Can a user create an offer draft from voice command?
- Does the review screen feel trustworthy?
- Does the dashboard make the next action obvious?
- Do users ask for real VoIP recording after seeing the demo?
- Do users say they would pay for this if it worked with their real calls?

## Main product risk

The biggest risk is overbuilding.

The product includes many directions: CRM, calls, AI, offers, tasks, recording, ads, import, teams.

The MVP must focus on the magic loop:

Conversation → AI review → CRM/tasks/offer → quick action
