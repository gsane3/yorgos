// Web: same resolved scheme as native (the provider seeds from Appearance, so
// there's no separate hydration dance needed here).
import { useThemeMode } from '@/lib/theme-mode';

export function useColorScheme(): 'light' | 'dark' {
  return useThemeMode().scheme;
}
