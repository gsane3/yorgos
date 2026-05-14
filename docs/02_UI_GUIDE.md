# yorgos.ai UI Guide

## UI language

Greek only for MVP.

Use simple professional Greek. Avoid heavy SaaS terminology where possible.

Use words the average Greek professional understands.

Examples:

- Αρχική
- Πελάτες
- Tasks
- Προσφορές
- Νέα ενέργεια
- Χαμένες κλήσεις
- Εκκρεμότητες
- Προσφορά
- Περίληψη
- Επόμενη ενέργεια

## UI personality

The app should feel:

- Fast
- Practical
- Clean
- Trustworthy
- Assistant-like
- Built for work, not for decoration

It should not feel like:

- Heavy enterprise CRM
- Complicated call center software
- Overdesigned AI toy
- Legal/compliance product

## Visual style

Preferred style:

- Startup clean
- Light interface
- Clear cards
- Strong spacing
- Rounded cards
- Calm neutral background
- One clear primary action color
- Minimal visual noise

Offer preview style:

- Clean modern business document
- Not too corporate
- Not too playful
- Professional enough to send to real clients later

## Layout principles

### Mobile-first

The app is designed for a mobile browser first.

Most important mobile rules:

- Important actions must be reachable with one thumb.
- Use bottom navigation.
- Use a floating action button for New Action.
- Avoid dense tables on mobile.
- Use cards instead of heavy grids.
- Long information should be collapsible.
- AI review sections should be editable but not overwhelming.

### Desktop/browser compatible

Desktop should use the same structure, but with more space.

Suggested desktop layout:

- Left sidebar or wider top navigation
- Main content area
- Optional right panel for quick actions or today tasks
- CRM and offers can use table-like views on desktop

## Navigation

### Mobile bottom navigation

Tabs:

1. Αρχική
2. Πελάτες
3. Tasks
4. Προσφορές

No separate Assistant tab.

The assistant is accessed through:

- Microphone action
- + New Action
- Call flow
- Review flow

### Floating action button

Label:

+ New Action

Options:

- Νέα κλήση
- Υπαγόρευση
- Νέος πελάτης
- Νέα προσφορά

## Key screens

### 1. Mock Login / Register

Purpose:

Let user enter the app without real auth.

Should make clear this is not production auth.

Fields:

- Name
- Email
- Business name, optional on first screen or in onboarding

Primary button:

Συνέχεια

### 2. Onboarding

Purpose:

Set business context so AI can adapt tone, tasks and offer drafts.

Steps or sections:

- Business type
- Business details
- Logo preview upload
- Default VAT
- Default offer terms

Business type options:

- Τεχνικές υπηρεσίες
- Πωλήσεις / υπηρεσίες
- Κατασκευές / έργα
- Άλλο

Important copy:

Το yorgos.ai θα προσαρμόζει τις περιλήψεις, τα tasks και τις προσφορές με βάση το επάγγελμά σου.

### 3. Dashboard / Αρχική

Purpose:

Tell the user what needs attention now.

Sections in order:

1. Χαμένες κλήσεις
2. Leads για κλήση
3. Σημερινά tasks
4. Ανοιχτές προσφορές
5. Πρόσφατες κλήσεις

Top area should include a quick assistant prompt:

Τι θέλεις να οργανώσω;

Actions:

- Microphone
- Type fallback
- + New Action

### 4. CRM list / Πελάτες

Purpose:

Simple customer list with useful context.

Each customer card shows:

- Name
- Status
- Source
- Opportunity value
- Next task
- Last communication

Search and filters:

- Search bar
- Status filter
- Source filter
- Has open task filter
- Has open offer filter

Search should support:

- Greek lowercase/uppercase
- No accents
- Greeklish basic matching
- Small typos
- Phone number search

### 5. Customer profile

Sections:

- Header: name, status, value, quick actions
- Contact info
- Source and preferred contact method
- Next best action
- Open tasks
- Offers
- Conversation summaries
- Notes

Quick actions:

- Call
- Open in Maps
- Create task
- Create offer
- Copy Viber draft
- Copy email draft

### 6. Tasks

Purpose:

Daily follow-up control.

Views:

- Today
- Upcoming
- Overdue
- Completed

Task card:

- Title
- Customer
- Date/time
- Type
- Priority
- Status
- Related offer/call if any

Actions:

- Mark completed
- Call customer
- Open customer
- Edit

### 7. Offers

Purpose:

Control offer pipeline.

Offer card/table fields:

- Customer
- Amount
- Status
- Date
- Valid until
- Related task

Actions:

- Preview
- Copy Viber message
- Copy email draft
- Mark as sent
- Mark as accepted
- Mark as rejected

### 8. Offer preview

Purpose:

Show a PDF-style preview from a base template.

Must include:

- Client logo from local preview
- Business details
- Customer details
- Offer number
- Date
- Valid until
- Line items
- VAT
- Total
- Notes
- Terms
- Acceptance text

Do not show a fake download if real PDF export is not built.

Use label:

Preview προσφοράς

### 9. Mock call screen

Purpose:

Show future call recording value without real VoIP.

Must include:

- Mock/Demo label
- Customer name or unknown number
- Call type
- Duration timer
- Recording indicator, clearly demo
- Mute button, mock
- Speaker button, mock
- End call button

After End call:

Show AI processing and then review screen.

### 10. AI review screen

Purpose:

Let user verify and edit before saving.

Sections:

- Πελάτης
- Περίληψη
- Ανάγκες πελάτη
- Tasks
- Προσφορά, if relevant
- Status update
- Warnings

No full transcript storage.

Warnings examples:

- Χρειάζεται επιβεβαίωση ποσού
- Χρειάζεται επιβεβαίωση πελάτη
- Χρειάζεται επιβεβαίωση ημερομηνίας

Actions:

- Save
- Edit
- Cancel

### 11. Success screen

After Save, show:

Αποθηκεύτηκε στο CRM

Quick actions:

- Άνοιγμα πελάτη
- Κλήση πελάτη
- Άνοιγμα σε Google Maps
- Δημιουργία προσφοράς
- Αντιγραφή Viber μηνύματος
- Αντιγραφή email draft
- Προγραμματισμός follow-up

### 12. Settings

Purpose:

Edit business and offer defaults.

Sections:

- Business details
- Logo preview
- VAT
- Offer terms
- Communication preferences
- Workspace mock
- CRM import placeholder

CRM import area:

Import CRM

Upload XLS / CSV

Coming soon

## Interaction rules

- Every AI result must be reviewed before save.
- Any destructive action needs confirmation.
- Mock features must be labelled clearly.
- Do not show fake success for real integrations not built.
- Keep forms short on mobile.
- Use expandable sections for dense details.

## Accessibility and usability

- Buttons should be large enough for mobile use.
- Important actions should have clear labels.
- Do not rely only on icons.
- Use strong contrast.
- Avoid small text in offer preview on mobile.
- Provide manual text input fallback for speech-to-text.
