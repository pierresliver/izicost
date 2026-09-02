// One line of the shopping list: tick, name, quantity stepper, delete.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import type { BasketItem } from '../api';

export function BasketItemRow({ item, onToggle, onQty, onRemove, onOpen }: {
  item: BasketItem; onToggle: () => void; onQty: (qty: number) => void; onRemove: () => void; onOpen?: () => void;
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
        {item.product_key ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="pricetag-outline" size={11} color={Brand.primary} />
            <ThemedText type="small" style={{ color: Brand.primary, fontSize: 12, lineHeight: 16 }}>{t('in the catalogue')}</ThemedText>
          </View>
        ) : null}
      </Pressable>
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
});
