// Shelf scan, step 4: check every price the server read, fix or drop lines, then publish.
import '@/features/shelf/i18n';

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { Chip } from '@/features/reports/ui';
import { saveShelfScan, SHELF_CATEGORIES, type ShelfItem } from '@/features/shelf/api';
import { disposeSession, getSession } from '@/features/shelf/session';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { parseNumber } from '@/lib/numbers';
import { formatMoney } from '@/lib/receipts';

type Row = ShelfItem & { _id: string };
const newId = () => Math.random().toString(36).slice(2);
const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

function NumInput({ value, onChange, style, placeholder }: { value: number | null; onChange: (n: number | null) => void; style: object; placeholder?: string }) {
  const [text, setText] = useState(str(value));
  return <TextInput style={style} keyboardType="decimal-pad" value={text} placeholder={placeholder} placeholderTextColor="#888" onChangeText={(v) => { setText(v); onChange(parseNumber(v)); }} />;
}

export default function ShelfReviewScreen() {
  useLang();
  const theme = useTheme();
  const router = useRouter();
  const session = getSession();
  const [rows, setRows] = useState<Row[]>(() => (session?.items ?? []).map((it) => ({ ...it, _id: newId() })));
  const [saving, setSaving] = useState(false);

  if (!session) {
    return <ThemedView style={styles.screen}><Stack.Screen options={{ title: t('Shelf scan') }} /><ThemedText>{t('Nothing to save')}</ThemedText></ThemedView>;
  }

  const unreadable = session.photoNotes.filter((p) => !p.readable).length;
  const lowCount = rows.filter((r) => r.confidence === 'low').length;
  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];
  const patch = (id: string, p: Partial<ShelfItem>) => setRows((list) => list.map((r) => (r._id === id ? { ...r, ...p } : r)));
  const remove = (id: string) => setRows((list) => list.filter((r) => r._id !== id));
  const add = () => setRows((list) => [...list, { _id: newId(), name: '', brand: null, size: null, price: 0, price_per: 'each', promo: false, category: 'food', subcategory: 'other_food', confidence: 'low', photo_index: -1, manual: true }]);

  async function publish() {
    const valid = rows.filter((r) => r.name.trim().length >= 2 && r.price > 0);
    if (!valid.length) { Alert.alert(t('Nothing to publish'), t('Every line needs a name and a price.')); return; }
    setSaving(true);
    try {
      const res = await saveShelfScan(session!.store.id, session!.currency, valid.map(({ _id, ...it }) => it), session!.photosRead);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const storeId = session!.store.id;
      const kept = res.saved - res.published;
      const body = t('%n% prices from %store% are now in the community pool.', { n: res.published, store: session!.store.name })
        + (kept > 0 ? ` ${t('%n% typed lines were kept for you only.', { n: kept })}` : '');
      Alert.alert(t('Published 🎉'), body, [
        { text: t('See the store page'), onPress: () => { disposeSession(); router.replace({ pathname: '/store/[id]', params: { id: storeId } }); } },
        { text: t('Done'), onPress: () => { disposeSession(); router.navigate('/scan'); } },
      ], { cancelable: false });
    } catch (e) {
      Alert.alert(t('Could not publish'), String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    Alert.alert(t('Discard these prices?'), undefined, [
      { text: t('Keep'), style: 'cancel' },
      { text: t('Discard'), style: 'destructive', onPress: () => { disposeSession(); router.navigate('/scan'); } },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('Check the prices') }} />
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Ionicons name="storefront" size={22} color={Brand.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">{session.store.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{t('%items% prices read from %photos% photos', { items: rows.length, photos: session.photosRead })}{unreadable ? ` · ${t('%n% photos unreadable', { n: unreadable })}` : ''}</ThemedText>
            </View>
          </View>
          {lowCount ? <ThemedText type="small" themeColor="textSecondary">{t('Doubtful lines are highlighted. Tap any value to fix it.')}</ThemedText> : null}
          {!rows.length ? <ThemedText themeColor="textSecondary">{t('No price label could be read. Try walking slower, closer to the shelf, in better light.')}</ThemedText> : null}
        </ThemedView>

        {rows.map((r) => (
          <ThemedView key={r._id} type="backgroundElement" style={[styles.card, r.confidence === 'low' && styles.low]}>
            <View style={styles.row}>
              <TextInput style={[inputStyle, { flex: 1 }]} value={r.name} placeholder={t('Product')} placeholderTextColor="#888" onChangeText={(v) => patch(r._id, { name: v })} />
              <NumInput style={[inputStyle, styles.price]} value={r.price || null} placeholder={t('Price')} onChange={(n) => patch(r._id, { price: n ?? 0 })} />
              <Pressable onPress={() => remove(r._id)} hitSlop={8} accessibilityLabel={t('Remove')}><Ionicons name="close-circle" size={22} color={Brand.danger} /></Pressable>
            </View>
            <View style={styles.row}>
              <TextInput style={[inputStyle, { flex: 1 }]} value={r.brand ?? ''} placeholder={t('Brand (optional)')} placeholderTextColor="#888" onChangeText={(v) => patch(r._id, { brand: v || null })} />
              <View style={styles.chips}>
                <Chip label={t('each')} active={r.price_per === 'each'} onPress={() => patch(r._id, { price_per: 'each' })} />
                <Chip label={t('per kg')} active={r.price_per === 'per_kg'} onPress={() => patch(r._id, { price_per: 'per_kg' })} />
                <Chip label={t('per l')} active={r.price_per === 'per_l'} onPress={() => patch(r._id, { price_per: 'per_l' })} />
                <Chip label={t('promo')} active={r.promo} onPress={() => patch(r._id, { promo: !r.promo })} />
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {SHELF_CATEGORIES.map((c) => <Chip key={c} label={t(c)} active={r.category === c} onPress={() => patch(r._id, { category: c })} />)}
            </ScrollView>
            <ThemedText type="small" themeColor="textSecondary">{formatMoney(r.price, session.currency)}{r.price_per === 'per_kg' ? ` / ${t('kg')}` : r.price_per === 'per_l' ? ` / ${t('l')}` : ''}{r.promo ? ` · ${t('promotion')}` : ''}{r.photo_index >= 0 ? ` · ${t('photo %n%', { n: r.photo_index + 1 })}` : ` · ${t('typed by hand')}`}</ThemedText>
          </ThemedView>
        ))}
        <Pressable style={styles.addBtn} onPress={add}>
          <Ionicons name="add-circle" size={20} color={Brand.primary} />
          <ThemedText style={{ color: Brand.primary, fontWeight: '600' }}> {t('Add item')}</ThemedText>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.saveBtn, (pressed || saving || !rows.length) && { opacity: 0.7 }]} disabled={saving || !rows.length} onPress={publish}>
          <Ionicons name="cloud-upload" color="#fff" size={24} />
          <ThemedText style={styles.saveText}>{saving ? t('Publishing…') : rows.length === 1 ? t('Publish %n% price', { n: 1 }) : t('Publish %n% prices', { n: rows.length })}</ThemedText>
        </Pressable>
        <Pressable style={styles.cancel} onPress={cancel}><ThemedText themeColor="textSecondary">{t('Discard')}</ThemedText></Pressable>
        <View style={styles.rowCenter}>
          <Ionicons name="lock-closed-outline" size={12} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">{t('Shared anonymously: product, shop, price and date. Never who scanned it.')}</ThemedText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  low: { borderWidth: 2, borderColor: Brand.warning },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  price: { width: 96, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.two },
  saveBtn: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.success, borderRadius: 16, paddingVertical: 18 },
  saveText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
});
