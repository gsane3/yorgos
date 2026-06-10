import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { LoginScreen } from '@/components/login-screen';
import { Brand } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { registerForIncoming } from '@/lib/twilio';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Gate />
      </ThemeProvider>
    </AuthProvider>
  );
}

// Auth gate: spinner while restoring the session, login when signed out, the
// native tabs when in. On the classic RN architecture the Twilio native module is
// registered at bridge startup, so importing the voice SDK eagerly (above) is safe
// — no lazy-load hack. We register for incoming calls automatically once we have a
// session, so the phone rings in the background without any manual "connect" tap.
function Gate() {
  const { session, loading } = useAuth();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    void registerForIncoming();
  }, [userId]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Brand.primary} />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <AppTabs />;
}
