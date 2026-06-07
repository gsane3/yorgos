'use client';

// Native push registration (Capacitor). On the web this is a NO-OP — every path
// is guarded by Capacitor.isNativePlatform(), and the heavy plugins are loaded
// via dynamic import so they never enter the web bundle.
//
// Flow: confirm native platform → request OS notification permission → register
// with FCM/APNs → POST the device token to /api/push/register → on tap, deep-link
// into the app. Push is a non-critical enhancement: any failure is swallowed.

import { createBrowserSupabaseClient } from '@/lib/supabase/client';

let initialized = false;

async function sendToken(token: string, platform: 'android' | 'ios'): Promise<void> {
  try {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) return;
    await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ token, platform }),
    });
  } catch {
    // ignore — registration will be retried on the next cold start
  }
}

/**
 * Registers the current device for push notifications. Safe to call on web
 * (returns immediately) and idempotent within a JS context.
 * @param navigate optional SPA navigation used when a notification is tapped.
 */
export async function registerNativePush(navigate?: (url: string) => void): Promise<void> {
  if (initialized) return;

  let Capacitor: (typeof import('@capacitor/core'))['Capacitor'];
  try {
    ({ Capacitor } = await import('@capacitor/core'));
  } catch {
    return;
  }
  if (!Capacitor?.isNativePlatform?.()) return; // web / PWA → skip
  initialized = true;

  const platform: 'android' | 'ios' = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';

  let PushNotifications: (typeof import('@capacitor/push-notifications'))['PushNotifications'];
  try {
    ({ PushNotifications } = await import('@capacitor/push-notifications'));
  } catch {
    return;
  }

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    await PushNotifications.addListener('registration', (tokenData) => {
      void sendToken(tokenData.value, platform);
    });
    await PushNotifications.addListener('registrationError', () => {
      // swallow — non-critical
    });
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification?.data as Record<string, unknown> | undefined;
      const url = typeof data?.url === 'string' ? data.url : undefined;
      if (!url) return;
      if (navigate) navigate(url);
      else window.location.assign(url);
    });

    await PushNotifications.register();
  } catch {
    // ignore — push is an enhancement, never block the app
  }
}
