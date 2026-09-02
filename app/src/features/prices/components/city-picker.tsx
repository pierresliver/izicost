// Bottom-sheet style modal to pick a city.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import type { CityRow } from '../api';

export function CityPicker({ visible, cities, title, onSelect, onClose }: {
  visible: boolean; cities: CityRow[]; title: string; onSelect: (c: CityRow) => void; onClose: () => void;
}) {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const rows = q.trim() ? cities.filter((c) => norm(c.city).includes(norm(q))) : cities;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <ThemedView style={styles.sheet}>
        <View style={styles.header}>
          <ThemedText type="smallBold" style={{ fontSize: 18 }}>{title}</ThemedText>
          <Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={24} color={theme.textSecondary} /></Pressable>
        </View>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          placeholder={t('Search city')} placeholderTextColor="#888" value={q} onChangeText={setQ} autoCorrect={false}
        />
        <FlatList
          data={rows}
          keyExtractor={(c) => `${c.city}|${c.country ?? ''}`}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<ThemedText themeColor="textSecondary" style={styles.empty}>{t('No city found.')}</ThemedText>}
          renderItem={({ item }) => (
            <Pressable onPress={() => { onSelect(item); setQ(''); }} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="location-outline" size={18} color={Brand.primary} />
              <ThemedText style={{ flex: 1 }}>{item.city}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[item.country, item.product_count !== undefined ? `${item.product_count} ${t('products')}` : null].filter(Boolean).join(' · ')}
              </ThemedText>
            </Pressable>
          )}
        />
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.three, paddingBottom: Spacing.five },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, marginBottom: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10 },
  empty: { textAlign: 'center', marginVertical: Spacing.four },
});
