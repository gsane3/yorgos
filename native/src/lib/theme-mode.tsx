// App-wide light/dark mode with a persisted manual override.
//
// `pref` is the user's explicit choice (persisted); when null we follow the OS.
// Everything that calls `useColorScheme()` (ThemedText/ThemedView/useTheme and
// the screens) reads the resolved scheme from here, so a single toggle in
// Ρυθμίσεις → Εμφάνιση flips the whole app.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

type Scheme = 'light' | 'dark';
type Pref = Scheme | null; // null → follow the system appearance

const STORAGE_KEY = 'opiflow.themePref';

type ThemeModeValue = {
  scheme: Scheme;
  isDark: boolean;
  pref: Pref;
  setDark: (value: boolean) => void;
};

const ThemeModeContext = createContext<ThemeModeValue>({
  scheme: 'light',
  isDark: false,
  pref: null,
  setDark: () => {},
});

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<Pref>(null);
  const [systemScheme, setSystemScheme] = useState<Scheme>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark') setPref(v);
      })
      .catch(() => {});

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const setDark = useCallback((value: boolean) => {
    const next: Scheme = value ? 'dark' : 'light';
    setPref(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const scheme: Scheme = pref ?? systemScheme;

  const value = useMemo<ThemeModeValue>(
    () => ({ scheme, isDark: scheme === 'dark', pref, setDark }),
    [scheme, pref, setDark],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
