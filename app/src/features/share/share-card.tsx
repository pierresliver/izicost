// Share cards: a branded image of a price, a saving, a chart or a number, sent through the phone's share
// sheet (WhatsApp etc.). The card is rendered in a preview modal, captured as PNG, then shared. Every card
// carries the app name and the invite line, so each share is also an invitation.
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import './i18n';
import { APP_LINK } from './share';

const CARD_W = 340;

/** The card itself: green header, white body, footer with the invite line. Always light (it is an image). */
export function ShareCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>IziCost</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <Text style={styles.date}>{today}</Text>
      </View>
      <View style={styles.body}>{children}</View>
      <View style={styles.foot}>
        <Ionicons name="receipt-outline" size={14} color={Brand.primary} />
        <Text style={styles.footText}>{t('Prices from real receipts, shared anonymously.')} {APP_LINK ? APP_LINK : t('Ask me for the app.')}</Text>
      </View>
    </View>
  );
}

// ── ready-made bodies ─────────────────────────────────────────────────────────────────────────

export function BigNumber({ value, label, tone }: { value: string; label?: string; tone?: 'up' | 'down' | 'neutral' }) {
  const color = tone === 'down' ? Brand.success : tone === 'up' ? Brand.danger : '#111';
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={[styles.big, { color }]}>{value}</Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

export function Rows({ rows, highlightFirst }: { rows: { left: string; right: string; sub?: string }[]; highlightFirst?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      {rows.map((r, i) => (
        <View key={`${r.left}-${i}`} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLeft, highlightFirst && i === 0 && { color: Brand.primary, fontWeight: '800' }]} numberOfLines={1}>{r.left}</Text>
            {r.sub ? <Text style={styles.rowSub} numberOfLines={1}>{r.sub}</Text> : null}
          </View>
          <Text style={[styles.rowRight, highlightFirst && i === 0 && { color: Brand.primary }]}>{r.right}</Text>
        </View>
      ))}
    </View>
  );
}

// ── the modal: preview + share ────────────────────────────────────────────────────────────────

export function ShareCardModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  async function share() {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) throw new Error(t('Sharing is not available on this device.'));
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'IziCost' });
      onClose();
    } catch (e) { Alert.alert(t('Could not share'), String((e as Error).message ?? e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three }]}>
        <ThemedText type="smallBold" style={{ fontSize: 16, textAlign: 'center' }}>{t('Share as an image')}</ThemedText>
        <View style={{ alignItems: 'center' }}>
          <View ref={ref} collapsable={false} style={{ width: CARD_W }}>{children}</View>
        </View>
        <Pressable onPress={share} disabled={busy} style={({ pressed }) => [styles.primary, (pressed || busy) && { opacity: 0.8 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="share-social" size={20} color="#fff" />}
          <ThemedText style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{t('Share')}</ThemedText>
        </Pressable>
        <Pressable onPress={onClose} style={{ alignItems: 'center', paddingVertical: Spacing.two }}><ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText></Pressable>
      </View>
    </Modal>
  );
}

/** Small round share button for screen headers and cards. */
export function ShareButton({ onPress, label }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={t('Share')} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}>
      <Ionicons name="share-social" size={16} color={Brand.primary} />
      {label ? <ThemedText type="small" style={{ color: Brand.primary, fontWeight: '700' }}>{label}</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_W, borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, backgroundColor: Brand.primary, padding: Spacing.three },
  brand: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: '800', marginTop: 2 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginTop: 2 },
  date: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  body: { padding: Spacing.three, gap: Spacing.two, backgroundColor: '#fff' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.three, paddingVertical: 10, backgroundColor: '#F0F5F2' },
  footText: { flex: 1, color: '#4B5563', fontSize: 11, lineHeight: 15 },
  big: { fontSize: 40, lineHeight: 46, fontWeight: '900' },
  label: { color: '#4B5563', fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  rowLeft: { color: '#111', fontSize: 15, fontWeight: '600' },
  rowSub: { color: '#6B7280', fontSize: 12 },
  rowRight: { color: '#111', fontSize: 15, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: '#00000088' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.three, gap: Spacing.three },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, backgroundColor: Brand.primary, borderRadius: 14, paddingVertical: 14 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Brand.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
