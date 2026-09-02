import '@/features/scan/i18n';

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { attachExtraPhotos, removeUploaded } from '@/features/scan/api';
import { parseNumber } from '@/lib/numbers';
import { PhotoStrip } from '@/features/scan/components/photo-strip';
import { PhotoViewer } from '@/features/scan/components/photo-viewer';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { clearPending, takePending } from '@/lib/pending';
import { formatMoney, saveReceipt } from '@/lib/receipts';
import { CATEGORIES, PAYMENT_METHODS, type ExtractedItem, type Extraction } from '@/lib/types';

const num = parseNumber;
const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/** A number field that keeps what you type (so "12." survives) and reports the parsed value. */
function NumInput({ value, onChange, style, placeholder }: { value: number | null; onChange: (n: number | null) => void; style: object; placeholder?: string }) {
  const [text, setText] = useState(str(value));
  return (
    <TextInput style={style} keyboardType="decimal-pad" value={text} placeholder={placeholder} placeholderTextColor="#888"
      onChangeText={(v) => { setText(v); onChange(num(v)); }} />
  );
}

type Row = ExtractedItem & { _id: string };
const newId = () => Math.random().toString(36).slice(2);

export default function ConfirmScreen() {
  useLang();
  const router = useRouter();
  const theme = useTheme();
  const pending = useMemo(() => takePending(), []);
  const [x, setX] = useState<(Omit<Extraction, 'items'> & { items: Row[] }) | null>(
    pending ? { ...pending.extraction, items: pending.extraction.items.map((it) => ({ ...it, _id: newId() })) } : null,
  );
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  // Leaving without saving (Cancel, back gesture, swipe-down): forget the draft and delete the
  // uploaded photos so nothing is left behind in storage.
  useEffect(() => {
    return () => {
      if (!saved && pending?.imagePaths?.length) removeUploaded(pending.imagePaths).catch(() => {});
      clearPending();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  if (!pending || !x) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>{t('Nothing to save')}</ThemedText>
      </ThemedView>
    );
  }

  type State = NonNullable<typeof x>;
  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];
  const set = (patch: Partial<Omit<Extraction, 'items'>>) => setX((prev) => ({ ...(prev as State), ...patch }));
  const setItem = (id: string, patch: Partial<ExtractedItem>) =>
    setX((prev) => ({ ...(prev as State), items: (prev as State).items.map((it) => (it._id === id ? { ...it, ...patch } : it)) }));
  const removeItem = (id: string) => setX((prev) => ({ ...(prev as State), items: (prev as State).items.filter((it) => it._id !== id) }));
  const addItem = () =>
    setX((prev) => ({
      ...(prev as State),
      items: [...(prev as State).items, { _id: newId(), name: '', qty: 1, unit_price: null, line_total: null, category: 'food', subcategory: 'other_food', confidence: 'low' }],
    }));

  const sum = x.items.reduce((s, it) => s + (it.line_total ?? 0), 0);
  const sumMatches = x.total !== null && Math.abs(sum - (x.discount_total ?? 0) - x.total) < 0.011;
  const photos = pending.localUris;

  async function onSave() {
    if (!x || !pending) return;
    setSaving(true);
    try {
      const cleaned: Extraction = {
        ...x,
        items: x.items.filter((it) => it.name.trim().length > 0).map(({ _id, ...it }) => it),
      };
      const id = await saveReceipt(cleaned, pending.imagePaths[0], pending.raw, pending.model);
      await attachExtraPhotos(id, pending.imagePaths); // no-op for a single photo
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      clearPending();
      router.navigate('/receipts'); // pops the modal and jumps to the Receipts tab
    } catch (e) {
      Alert.alert(t('Could not save'), String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.photos}>
          <PhotoStrip uris={photos} height={photos.length > 1 ? 170 : 230} onPress={setViewer} fillSingle />
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {photos.length > 1 ? `${photos.length} ${t('photos')} · ` : ''}{t('Tap a photo to enlarge it')}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary" style={styles.hint}>{t('Doubtful lines are highlighted. Tap any value to fix it.')}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <Field label={t('Store')}><TextInput style={inputStyle} value={x.store_name ?? ''} onChangeText={(v) => set({ store_name: v })} /></Field>
          <Field label={t('Address')}><TextInput style={inputStyle} value={x.store_branch_address ?? ''} onChangeText={(v) => set({ store_branch_address: v })} /></Field>
          <View style={styles.twoCol}>
            <Field label={t('Date')} flex><TextInput style={inputStyle} value={x.date ?? ''} placeholder="YYYY-MM-DD" placeholderTextColor="#888" onChangeText={(v) => set({ date: v })} /></Field>
            <Field label={t('Currency')} flex><TextInput style={inputStyle} value={x.currency ?? ''} autoCapitalize="characters" onChangeText={(v) => set({ currency: v.toUpperCase() })} /></Field>
          </View>
          <View style={styles.twoCol}>
            <Field label={t('Total')} flex>
              <NumInput style={[inputStyle, styles.bold]} value={x.total} onChange={(n) => set({ total: n })} />
            </Field>
            <Field label={t('Paid by')} flex>
              <View style={styles.chips}>
                {PAYMENT_METHODS.map((m) => (
                  <Chip key={m} label={t(m)} active={x.payment_method === m} onPress={() => set({ payment_method: x.payment_method === m ? null : m })} />
                ))}
              </View>
            </Field>
          </View>
        </ThemedView>

        <ThemedText type="subtitle">{t('Items')} ({x.items.length})</ThemedText>
        {x.items.map((it) => (
          <ThemedView key={it._id} type="backgroundElement" style={[styles.card, it.confidence === 'low' && styles.lowConfidence]}>
            <View style={styles.itemRow}>
              <NumInput style={[inputStyle, styles.qty]} value={it.qty} placeholder={t('Qty')} onChange={(n) => setItem(it._id, { qty: n })} />
              <TextInput style={[inputStyle, { flex: 1 }]} value={it.name} placeholder={t('Item')} placeholderTextColor="#888" onChangeText={(v) => setItem(it._id, { name: v })} />
              <NumInput style={[inputStyle, styles.price]} value={it.line_total} placeholder={t('Price')} onChange={(n) => setItem(it._id, { line_total: n })} />
              <Pressable onPress={() => removeItem(it._id)} hitSlop={8}><Ionicons name="close-circle" size={22} color={Brand.danger} /></Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {CATEGORIES.map((c) => (
                <Chip key={c} label={t(c)} active={it.category === c} onPress={() => setItem(it._id, { category: c })} />
              ))}
            </ScrollView>
          </ThemedView>
        ))}
        <Pressable style={styles.addBtn} onPress={addItem}>
          <Ionicons name="add-circle" size={20} color={Brand.primary} />
          <ThemedText style={{ color: Brand.primary, fontWeight: '600' }}> {t('Add item')}</ThemedText>
        </Pressable>

        {x.items.length > 0 ? (
          <View style={[styles.sumRow, { backgroundColor: sumMatches ? `${Brand.success}1A` : `${Brand.warning}1A` }]}>
            <Ionicons name={sumMatches ? 'checkmark-circle' : 'alert-circle'} size={20} color={sumMatches ? Brand.success : Brand.warning} />
            <ThemedText type="small" style={{ flex: 1, color: sumMatches ? Brand.success : undefined }}>
              {sumMatches ? t('Items match the total.') : t('Items add up to %sum%, receipt total is %total%.', { sum: formatMoney(sum), total: formatMoney(x.total) })}
            </ThemedText>
          </View>
        ) : null}

        <Pressable style={({ pressed }) => [styles.saveBtn, (pressed || saving) && { opacity: 0.7 }]} disabled={saving} onPress={onSave}>
          <Ionicons name="checkmark-circle" color="#fff" size={24} />
          <ThemedText style={styles.saveText}>{saving ? t('Saving…') : t('Save')}</ThemedText>
        </Pressable>
        <Pressable style={styles.cancel} onPress={() => { clearPending(); router.back(); }}>
          <ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText>
        </Pressable>
      </ScrollView>
      <PhotoViewer uris={photos} index={viewer} onClose={() => setViewer(null)} />
    </KeyboardAvoidingView>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <View style={[styles.field, flex && { flex: 1 }]}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <ThemedText type="small" style={active ? { color: '#fff', fontWeight: '700' } : undefined}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  photos: { gap: Spacing.two },
  hint: { textAlign: 'center' },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  lowConfidence: { borderWidth: 2, borderColor: Brand.warning },
  field: { gap: 4 },
  twoCol: { flexDirection: 'row', gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  bold: { fontWeight: '700' },
  itemRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  qty: { width: 62, textAlign: 'right' },
  price: { width: 92, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: Brand.primary, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipActive: { backgroundColor: Brand.primary },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.two },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, padding: Spacing.two + 4 },
  saveBtn: {
    flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.success, borderRadius: 16, paddingVertical: 18,
  },
  saveText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
