# Backend environment readiness

## Scope

Readiness notes for the two current server-side API routes:

- `POST /api/ai/review`
- `POST /api/email/send-offer`

This is not a deployment guide. It covers what env vars are needed and what safety rules apply before those routes are used in any environment.

---

## Server-only variables

All variables below are server-only. They must never be prefixed with `NEXT_PUBLIC_`. Doing so would expose them to the browser bundle.

| Variable | Used by | Required | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | `/api/ai/review` | Yes | AI provider key. Never expose to client. |
| `RESEND_API_KEY` | `/api/email/send-offer` | Yes, for real sends | Email provider key. Route returns 503 if missing. |
| `EMAIL_FROM` | `/api/email/send-offer` | Yes, for real sends | Sender address verified with Resend. Route returns 503 if missing. |
| `EMAIL_REPLY_TO` | `/api/email/send-offer` | No | Optional reply-to header on outgoing email. |

`RESEND_API_KEY` and `EMAIL_FROM` together enable real email delivery through the backend route. If either is missing, the route returns an error and no email is sent. The email route is already wired to one UI surface (`src/components/offers/SendEmailSection.tsx`). Real email is sent only when those two env vars are present. Without them, the UI displays a "not configured" message and no email is sent.

No real VoIP, no real call recording, and no real SMS sending are implemented in the current backend.

---

## Local development

1. Create `.env.local` at the project root.
2. Add only the variables you need locally. Example structure (use your own values):

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   RESEND_API_KEY=re_...
   EMAIL_FROM=you@yourdomain.com
   EMAIL_REPLY_TO=you@yourdomain.com
   ```

3. `.env.local` must not be committed. It is listed in `.gitignore`.
4. Restart the dev server after changing `.env.local`.

---

## Later Vercel deployment

Add each variable in Vercel Project Settings, under Environment Variables. Do not add them as `NEXT_PUBLIC_` variables.

### Email send modes for preview

**Safe preview mode (recommended first).** Omit `RESEND_API_KEY` and `EMAIL_FROM` from Vercel env settings. The email route returns `missing_email_config` and the UI shows a "not configured" message. No real email can be sent.

**Real email mode.** Add `RESEND_API_KEY` and `EMAIL_FROM` only if you accept that any visitor who reaches the UI can trigger real email sends, limited only by the in-memory rate limiter (5 requests per IP per 60 seconds, per serverless instance). There is no auth backend yet. Consider this only after auth is added or access is restricted.

### AI route timeout on Vercel Hobby

The AI route uses a 20-second `AbortController` timeout. Vercel Hobby serverless functions have a shorter default execution limit. If Vercel kills the function first, the response will be a Vercel error rather than the app's `ai_timeout` response. Before deploying, decide one of:

- Lower `AI_PROVIDER_TIMEOUT_MS` to stay under the plan limit.
- Add `export const maxDuration` to the route if the plan supports it.
- Use a plan with a function duration that covers 20 seconds or more.

---

## Safety checklist

Before testing or deploying either route, confirm the following:

- [ ] All required env vars are present in `.env.local` (or Vercel env settings for deployment).
- [ ] No provider keys use the `NEXT_PUBLIC_` prefix.
- [ ] `.env.local` is not staged (`git status --short` must not list it).
- [ ] AI review route tested locally with a safe, non-customer input.
- [ ] Email route tested only with a controlled recipient address you own. Do not use real customer email addresses during testing.

---

## Do not do yet

The following are not implemented and must not be added without a deliberate decision:

- No database. localStorage remains the MVP data store.
- No auth backend.
- No VoIP provider or real call handling.
- No SMS provider or real SMS sending.
- No automatic or background email sending. The email route is wired to one UI surface and sends only when triggered by a user action and only when provider env vars are set.
