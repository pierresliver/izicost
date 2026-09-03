// Bottom sheet for "say your list": listening -> making the list -> review -> add to basket.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import type { MatchedItem } from '../parse';

export type VoicePhase = 'listening' | 'parsing' | 'review' | 'error';

type Props = {
  visible: boolean;
  phase: VoicePhase;
  transcript: string;
  items: MatchedItem[];
  /** Human message for the error phase. */
  error: string | null;
  /** The server could not answer; the list came from the simple local splitter. */
  fallback: boolean;
  busy: boolean;
  onStop: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: (index: number) => void;
  onConfirm: () => void;
};

export function VoiceSheet({ visible, phase, transcript, items, error, fallback, busy, onStop, onCancel, onRetry, onRemove, onConfirm }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (!visible || phase !== 'listening') { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.18, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, phase, pulse]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={phase === 'listening' ? undefined : onCancel} />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />

        {phase === 'listening' ? (
          <View style={styles.center}>
            <Animated.View style={[styles.micRing, { transform: [{ scale: pulse }] }]}>
              <View style={styles.mic}><Ionicons name="mic" size={40} color="#fff" /></View>
            </Animated.View>
            <ThemedText style={styles.title}>{t('Listening…')}</ThemedText>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {t('Say your list, e.g. “two kilos of rice, milk, a dozen eggs”.')}
            </ThemedText>
            <View style={[styles.transcript, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={{ textAlign: 'center', fontSize: 17, lineHeight: 24 }} numberOfLines={4}>
                {transcript || '…'}
              </ThemedText>
            </View>
            <Pressable onPress={onStop} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <ThemedText style={styles.primaryText}>{t('Done')}</ThemedText>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.link}><ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText></Pressable>
          </View>
        ) : null}

        {phase === 'parsing' ? (
          <View style={[styles.center, { paddingVertical: Spacing.five }]}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <ThemedText style={styles.title}>{t('Making your list…')}</ThemedText>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }} numberOfLines={3}>“{transcript}”</ThemedText>
          </View>
        ) : null}

        {phase === 'review' ? (
          <View style={{ gap: Spacing.two }}>
            <ThemedText style={styles.title}>{t('Is this your list?')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>“{transcript}”</ThemedText>
            {fallback ? (
              <View style={[styles.note, { backgroundColor: `${Brand.warning}1A` }]}>
                <Ionicons name="cloud-offline-outline" size={16} color={Brand.warning} />
                <ThemedText type="small" style={{ flex: 1 }}>{t('The list service could not be reached, so the list was split the simple way. Check it before adding.')}</ThemedText>
              </View>
            ) : null}
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 6 }}>
              {items.map((it, i) => (
                <View key={`${it.label}-${i}`} style={[styles.item, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.qtyBadge}><ThemedText type="smallBold" style={{ color: '#fff' }}>{Number.isInteger(it.qty) ? it.qty : String(it.qty).replace('.', ',')}</ThemedText></View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: '600' }} numberOfLines={1}>{it.product ? it.product.display_name : it.label}</ThemedText>
                    <ThemedText type="small" themeColor={it.product ? undefined : 'textSecondary'} style={it.product ? { color: Brand.primary } : undefined}>
                      {it.product ? t('in the catalogue') : t('not in the catalogue yet')}
                    </ThemedText>
                  </View>
                  <Pressable onPress={() => onRemove(i)} hitSlop={8} accessibilityLabel={t('Remove')}>
                    <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={onConfirm} disabled={busy || !items.length} style={({ pressed }) => [styles.primary, (pressed || busy || !items.length) && { opacity: 0.7 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="basket" size={20} color="#fff" />}
              <ThemedText style={styles.primaryText}>
                {items.length === 1 ? t('Add 1 item and compare') : t('Add %n% items and compare', { n: items.length })}
              </ThemedText>
            </Pressable>
            <View style={styles.rowBtns}>
              <Pressable onPress={onRetry} style={styles.link}><Ionicons name="mic-outline" size={16} color={Brand.primary} /><ThemedText style={{ color: Brand.primary, fontWeight: '600' }}> {t('Speak again')}</ThemedText></Pressable>
              <Pressable onPress={onCancel} style={styles.link}><ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText></Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'error' ? (
          <View style={styles.center}>
            <View style={[styles.mic, { backgroundColor: Brand.warning }]}><Ionicons name="mic-off" size={36} color="#fff" /></View>
            <ThemedText style={styles.title}>{t('Could not hear a list')}</ThemedText>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>{error}</ThemedText>
            <Pressable onPress={onRetry} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
              <Ionicons name="mic" size={20} color="#fff" />
              <ThemedText style={styles.primaryText}>{t('Try again')}</ThemedText>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.link}><ThemedText themeColor="textSecondary">{t('Type instead')}</ThemedText></Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.two },
  center: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  micRing: { width: 104, height: 104, borderRadius: 52, backgroundColor: 'rgba(11,110,79,0.15)', alignItems: 'center', justifyContent: 'center' },
  mic: { width: 80, height: 80, borderRadius: 40, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  transcript: { alignSelf: 'stretch', borderRadius: 14, padding: Spacing.three, minHeight: 64, justifyContent: 'center' },
  primary: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, backgroundColor: Brand.primary, borderRadius: 14, paddingVertical: 14 },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  rowBtns: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.three },
  note: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, padding: Spacing.two },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, padding: Spacing.two, paddingRight: 12 },
  qtyBadge: { minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 8, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
});
