// One line of the shopping list: tick, name, quantity stepper, delete.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import type { BasketItem } from '../api';

export function BasketItemRow({ item, onToggle, onQty, onRemove, onOpen, onBrand }: {
  item: BasketItem; onToggle: () => void; onQty: (qty: number) => void; onRemove: () => void; onOpen?: () => void; onBrand?: () => void;
}) {
  const theme = useTheme();
  const qtyText = Number.isInteger(item.qty) ? String(item.qty) : String(item.qty).replace('.', ',');
  return (
    <ThemedView type="backgroundElement" style={[styles.row, item.checked && { opacity: 0.55 }]}>
      <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: item.checked }}>
        <Ionicons name={item.checked ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={item.checked ? Brand.success : theme.textSecondary} />
      </Pressable>
      <Pressable onPress={onOpen} disabled={!onOpen} style={{ flex: 1, gap: 1 }}>
        <ThemedText style={[{ fontSize: 16, lineHeight: 20, fontWeight: '600' }, item.checked && { textDecorationLine: 'line-through' }]} numberOfLines={2}>{item.name}</ThemedText>
      </Pressable>
      {onBrand ? (
        <Pressable onPress={onBrand} hitSlop={6} style={[styles.brandChip, { backgroundColor: item.brand_pref ? `${Brand.primary}22` : theme.backgroundSelected }]} accessibilityLabel={t('Brand')}>
          <Ionicons name="pricetag-outline" size={11} color={item.brand_pref ? Brand.primary : theme.textSecondary} />
          <ThemedText type="small" numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, maxWidth: 72, color: item.brand_pref ? Brand.primary : theme.textSecondary, fontWeight: item.brand_pref ? '700' : '500' }}>
            {item.brand_pref ?? t('Any brand')}
          </ThemedText>
        </Pressable>
      ) : null}
      <View style={[styles.stepper, { backgroundColor: theme.backgroundSelected }]}>
        <Pressable onPress={() => onQty(Math.max(1, Math.ceil(item.qty) - 1))} hitSlop={6} style={styles.stepBtn} disabled={item.qty <= 1}>
          <Ionicons name="remove" size={16} color={item.qty <= 1 ? theme.textSecondary : theme.text} />
        </Pressable>
        <ThemedText type="smallBold" style={{ minWidth: 22, textAlign: 'center' }}>{qtyText}</ThemedText>
        <Pressable onPress={() => onQty(Math.floor(item.qty) + 1)} hitSlop={6} style={styles.stepBtn}>
          <Ionicons name="add" size={16} color={theme.text} />
        </Pressable>
      </View>
      <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={t('Remove')}>
        <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 2 },
  stepBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  brandChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
});
