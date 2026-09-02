import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { t } from '@/lib/i18n';

type Props = {
  uris: string[];
  /** Which photo to open; null = closed. */
  index: number | null;
  onClose: () => void;
};

/** Full-screen, swipeable photo viewer (one page per photo of the receipt). */
export function PhotoViewer({ uris, index, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ref = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const open = index !== null;

  useEffect(() => {
    if (index === null) return;
    setPage(index);
    const id = setTimeout(() => ref.current?.scrollTo({ x: index * width, animated: false }), 0);
    return () => clearTimeout(id);
  }, [index, width]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onEnd}
          onLayout={() => { if (index !== null) ref.current?.scrollTo({ x: index * width, animated: false }); }}>
          {uris.map((uri, i) => (
            <Image key={`${uri}-${i}`} source={{ uri }} style={{ width, height }} resizeMode="contain" />
          ))}
        </ScrollView>
        <View style={[styles.top, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityLabel={t('Close')}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          {uris.length > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>{t('Photo %n% of %total%', { n: page + 1, total: uris.length })}</Text>
            </View>
          ) : null}
          <View style={{ width: 44 }} />
        </View>
        {uris.length > 1 ? (
          <View style={[styles.dots, { bottom: insets.bottom + Spacing.four }]} pointerEvents="none">
            {uris.map((_, i) => <View key={i} style={[styles.dot, i === page && styles.dotActive]} />)}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: Spacing.three,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' },
  counter: { backgroundColor: '#00000066', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  counterText: { color: '#fff', fontWeight: '600' },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff66' },
  dotActive: { backgroundColor: '#fff' },
});
