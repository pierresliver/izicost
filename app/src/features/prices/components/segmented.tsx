// Segmented control: pills in a rounded track, selected one in brand green.
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentOption<K extends string> = { key: K; label: string };

export function Segmented<K extends string>({ options, value, onChange, scroll }: {
  options: SegmentOption<K>[]; value: K; onChange: (k: K) => void; scroll?: boolean;
}) {
  const theme = useTheme();
  const items = options.map((o) => {
    const on = o.key === value;
    return (
      <Pressable
        key={o.key}
        onPress={() => onChange(o.key)}
        style={[styles.pill, on && { backgroundColor: Brand.primary }, !scroll && { flex: 1 }]}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}>
        <ThemedText type="smallBold" style={{ color: on ? '#fff' : theme.textSecondary, fontSize: 13 }} numberOfLines={1}>
          {o.label}
        </ThemedText>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        {items}
      </ScrollView>
    );
  }
  return <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>{items}</View>;
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 2 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
