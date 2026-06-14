// Resolved app color scheme — reads the persisted theme-mode override (or the
// system appearance when the user hasn't chosen). Replaces react-native's raw
// useColorScheme so a single in-app toggle flips the whole app.
import { useThemeMode } from '@/lib/theme-mode';

export function useColorScheme(): 'light' | 'dark' {
  return useThemeMode().scheme;
}
