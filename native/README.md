# Opiflow — native app (React Native / Expo)

The **true-native** Opiflow app (replaces the Capacitor remote-WebView). Same backend:
Supabase + the Vercel-hosted Next.js API (`https://www.opiflow.ai/api/*`). Native calling
via the official **Twilio Voice React-Native SDK** (incoming/outgoing + CallKit /
ConnectionService + VoIP push → rings on the lock screen, runs backgrounded/killed).

- **Stack:** Expo SDK 56 · expo-router (file-based, `src/app/`) · React Native 0.85 · TypeScript.
- **Brand:** primary blue **`#146EB4`** (`src/constants/theme.ts` → `Brand`).
- **App identity:** bundle id / package = **`ai.opiflow.app`** (same as the old app → reuses the
  Apple App ID, APNs key, and the VoIP Services Certificate already created in `../ios-voip-cert/`).

## Run (development)
```bash
cd native
npm install
npx expo start          # then press i / a, or scan in the dev client
```
> Plain `expo start` + Expo Go works for the JS UI. **Native modules (Twilio Voice, native tabs)
> need a Dev Client build** — see below. On Windows (no Mac), build iOS via **EAS Build** (cloud).

## Build (device / TestFlight) — EAS
```bash
npm i -g eas-cli
eas login                       # your Expo account
eas init                        # links the project (writes extra.eas.projectId)
eas build --profile development --platform ios   # dev client (for testing Twilio on device)
eas build --profile production  --platform ios   # store/TestFlight build
eas submit --platform ios       # upload to TestFlight (App ID ai.opiflow.app)
```
Profiles are in `eas.json`. iOS signing reuses the App Store Connect / App ID `ai.opiflow.app`.

## Roadmap (incremental — each step verified on device)
1. **Foundation (done):** branded shell, native tabs (Αρχική/…), theme `#146EB4`. ← you are here
2. **Auth:** Supabase email/OAuth login (reuse the same project) + session storage.
3. **API client:** typed fetch wrapper hitting `https://www.opiflow.ai/api/*` with the Supabase JWT.
4. **Screens:** Αρχική (chips) · Πελάτες → Messenger chat + info · Κλήσεις (dialer) · Ρυθμίσεις.
5. **Native calling:** `@twilio/voice-react-native-sdk` + config plugin — auto-register on launch,
   incoming via VoIP push (CallKit screen), outgoing, mute/speaker/hangup. Reuses the `/api/phone/
   twilio-token` endpoint + the US1 Twilio Voice setup already live.

## Notes
- `src/app/` = routes (expo-router). `src/components`, `src/constants/theme.ts`, `src/hooks`.
- The old Capacitor wrapper (`/android`, `capacitor.config.json`, `codemagic.yaml`) stays until this
  app reaches parity, then is retired.
