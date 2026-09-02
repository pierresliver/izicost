import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';

type Props = {
  uris: string[];
  /** Thumbnail height; width follows a receipt-like 3:4 ratio. */
  height?: number;
  onPress?: (index: number) => void;
  onRemove?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  /** Stretch a lone photo to fill the row instead of showing one small thumbnail. */
  fillSingle?: boolean;
};

/** Horizontal row of numbered receipt thumbnails. Tap to enlarge, optional remove button. */
export function PhotoStrip({ uris, height = 120, onPress, onRemove, style, fillSingle }: Props) {
  const w = Math.round(height * 0.75);
  const single = fillSingle && uris.length === 1;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={!single}
      contentContainerStyle={[styles.row, single && styles.rowSingle, style]}>
      {uris.map((uri, i) => (
        <Pressable
          key={`${uri}-${i}`}
          onPress={onPress ? () => onPress(i) : undefined}
          style={({ pressed }) => [styles.thumb, { width: single ? '100%' : w, height }, pressed && { opacity: 0.85 }]}>
          <Image source={{ uri }} style={styles.img} resizeMode={single ? 'contain' : 'cover'} />
          {uris.length > 1 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{i + 1}</Text></View>
          ) : null}
          {onRemove ? (
            <Pressable onPress={() => onRemove(i)} hitSlop={10} style={styles.remove}>
              <Ionicons name="close-circle" size={22} color="#fff" />
            </Pressable>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two },
  rowSingle: { flexGrow: 1 },
  thumb: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#00000018' },
  img: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute', left: 8, top: 8, minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7,
    backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  remove: { position: 'absolute', right: 4, top: 4, backgroundColor: '#00000066', borderRadius: 12 },
});
