// Green banner: "Rice 5kg is now 480 MT at Shoprite — your alert was 500". Tap → product page.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

import type { AlertHit } from '../api';
import '../i18n';

export function AlertBanner({ hits, onDismiss }: { hits: AlertHit[]; onDismiss: (alertId: string) => void }) {
  const router = useRouter();
  if (!hits.length) return null;
  return (
    <View style={{ gap: Spacing.two }}>
      {hits.map((h) => (
        <Pressable
          key={h.alert_id}
          onPress={() => { onDismiss(h.alert_id); router.push({ pathname: '/product/[key]', params: { key: h.product_key } }); }}
          style={({ pressed }) => [styles.banner, pressed && { opacity: 0.85 }]}>
          <View style={styles.icon}><Ionicons name="trending-down" size={18} color="#fff" /></View>
          <View style={{ flex: 1, gap: 1 }}>
            <ThemedText type="smallBold" style={{ color: Brand.success, fontSize: 12, lineHeight: 16 }}>{t('Price drop')}</ThemedText>
            <ThemedText type="small" style={{ lineHeight: 19 }}>
              {t('%name% is now %price% at %store% — your alert was %target%', {
                name: h.display_name, price: formatMoney(h.price, h.currency), store: [h.store_name, h.city].filter(Boolean).join(' · '),
                target: formatMoney(h.target_price, h.currency),
              })}
            </ThemedText>
          </View>
          <Pressable onPress={() => onDismiss(h.alert_id)} hitSlop={10} accessibilityLabel={t('Dismiss')}>
            <Ionicons name="close" size={18} color={Brand.success} />
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, padding: 12,
    backgroundColor: 'rgba(30,158,90,0.14)', borderWidth: 1, borderColor: 'rgba(30,158,90,0.45)',
  },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Brand.success, alignItems: 'center', justifyContent: 'center' },
});
