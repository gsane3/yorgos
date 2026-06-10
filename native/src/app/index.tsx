import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.logo}>
          <ThemedText style={styles.logoMark}>O</ThemedText>
        </View>
        <ThemedText type="title" style={styles.title}>
          Opiflow
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Το native app ξεκινά. Σύντομα εδώ: Αρχική, Πελάτες, Κλήσεις — όλα γηγενή, με
          σωστό τηλέφωνο (incoming, lock-screen, CallKit).
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: { color: Brand.onPrimary, fontSize: 44, fontWeight: '800' },
  title: { color: Brand.primary },
  subtitle: { textAlign: 'center', maxWidth: 340 },
});
