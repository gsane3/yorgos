# Native app (Android / iOS) — wrapper runbook

The web app is already **native-wrapper ready** (installable PWA, mobile viewport, safe-area insets, app-like navigation). The fastest path to "downloadable on Android/iOS" is a **Capacitor** wrapper that loads the live web app, then progressively adds native capabilities (push, native dialer) later.

A `capacitor.config.json` is already in the repo. It points the native shell at the production URL (`server.url`). **Change `appId` and `server.url` to your real values before building.**

## What's already set up in this repo

- **Capacitor 7** is installed (`@capacitor/core/cli/android/ios` in `package.json`). Cap 7 needs **Node ≥ 20**; Cap 8 would force Node ≥ 22.
- **`capacitor.config.json`** points the shell at the production URL (`server.url = https://deskop.ai`). Change it to your real domain before building.
- The **Android project is scaffolded** in `android/`, with:
  - app icons + splash generated from `assets/icon.png` / `assets/splash.png`,
  - **microphone permissions** (`RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`) — required for in-app calls + recording,
  - an **App-Links `intent-filter`** for `https://deskop.ai` (activates once the site serves `/.well-known/assetlinks.json` — see Deep links below).
- Convenience scripts: `npm run cap:sync`, `npm run cap:assets`, `npm run cap:android`, `npm run cap:add:ios`, `npm run cap:ios`.

## Build Android (any OS with Android Studio + a JDK)

```bash
npm run cap:sync       # copy web assets + config into android/ (run after any change)
npm run cap:android    # opens Android Studio → Run on device, or Build > Generate Signed Bundle/APK (.aab)
```
The Gradle build needs a JDK / Android Studio (not installed in this repo's dev box, so the bundle is produced on your machine).

## Add iOS (needs a Mac with Xcode + CocoaPods)

```bash
npm run cap:add:ios            # creates ios/ (Mac only)
npm run cap:assets             # icons + splash for iOS
npm run cap:sync
npm run cap:ios                # opens Xcode → Product > Archive → Distribute
```
Then in Xcode add `NSMicrophoneUsageDescription` to `Info.plist` (for calls/recording) and the **Associated Domains** capability `applinks:deskop.ai`.

## Submitting

- **Google Play**: create a Play Console account ($25 one-time), upload the signed `.aab`, fill store listing, roll out to internal testing first.
- **Apple App Store**: enroll in the Apple Developer Program ($99/yr), archive in Xcode, upload via TestFlight for internal testing, then submit for review.

## Important notes

- **Apple guideline 4.2 (minimum functionality):** a pure web-view wrapper can be rejected for public release. For internal pilots use **TestFlight** (no review friction). For public release, add native value first — the obvious candidates here are **native push notifications** (`@capacitor/push-notifications`) for offer/appointment responses, and later a **native calling layer**.
- **Icons:** the PWA icons (`public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) and native sources (`assets/icon.png`, `assets/splash.png`) are committed, generated from `public/icon.svg` + `public/icon-maskable.svg` via `node scripts/generate-icons.cjs`. Re-run that after changing the brand mark.
- **Deep links (Universal / App Links):** the app serves the association files itself, env-gated, so taps on `deskop.ai` links open the installed app instead of the browser:
  - **iOS** — `GET /.well-known/apple-app-site-association`: set `APPLE_APP_ID` to `<TeamID>.ai.deskop.app`, then add the Associated Domain `applinks:deskop.ai` in Xcode → Signing & Capabilities.
  - **Android** — `GET /.well-known/assetlinks.json`: set `ANDROID_SHA256_CERT_FINGERPRINTS` (comma-separated, from `keytool -list -v …` or Play Console → App signing) and optionally `ANDROID_PACKAGE_NAME` (defaults to `ai.deskop.app`), then add the `<intent-filter … android:autoVerify="true">` for `https://deskop.ai` to `AndroidManifest.xml`.
  - Until those env vars are set the routes return **404** — no broken association is ever published. The customer token pages (`/intake/*`, `/offer-response/*`, `/appointment-response/*`, `/upload/*`) still work as plain mobile-web for recipients who don't have the app.
- **Store badges:** the landing page badges (`src/components/marketing/StoreBadges.tsx`) currently link to `/register`. Replace `PLAY_STORE_URL` / `APP_STORE_URL` with the real store URLs after publishing.
- **Auth in the wrapper:** Supabase OAuth redirects must include the app's origin. Add your production domain (and any custom scheme) to Supabase → Authentication → URL Configuration → Redirect URLs.

## Alternative: Android TWA (no Mac needed for Android)

For Android only, a **Trusted Web Activity** (via Bubblewrap) ships the PWA straight from the manifest with no web-view chrome. Good for a fast Android-first launch:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://app.deskop.ai/manifest.webmanifest
bubblewrap build
```
