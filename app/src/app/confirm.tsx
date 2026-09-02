import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { clearPending, takePending } from '@/lib/pending';
import { formatMoney, saveReceipt } from '@/lib/receipts';
import { CATEGORIES, PAYMENT_METHODS, type ExtractedItem, type Extraction } from '@/lib/types';

/** Parse what a person types: "12.5", "12,5", "1.384,20", "1,384.20" all work. */
function num(s: string): number | null {
  let v = s.replace(/\s/g, '');
  const lastDot = v.lastIndexOf('.');
  const lastComma = v.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) v = lastComma > lastDot ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  else v = v.replace(',', '.');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
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

  async function onSave() {
    if (!x) return;
    setSaving(true);
    try {
      const cleaned: Extraction = {
        ...x,
        items: x.items.filter((it) => it.name.trim().length > 0).map(({ _id, ...it }) => it),
      };
      await saveReceipt(cleaned, pending!.imagePath, pending!.raw, pending!.model);
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
        <Image source={{ uri: pending.localUri }} style={styles.photo} resizeMode="contain" />
        <ThemedText themeColor="textSecondary" style={styles.hint}>{t('Doubtful lines are highlighted. Tap any value to fix it.')}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <Field label={t('Store')}><TextInput style={inputStyle} value={x.store_name ?? ''} onChangeText={(v) => set({ store_name: v })} /></Field>
          <Field label={t('Address')}><TextInput style={inputStyle} value={x.store_branch_address ?? ''} onChangeText={(v) => set({ store_branch_address: v })} /></Field>
          <View style={styles.twoCol}>
            <Field label={t('Date')} flex><TextInput style={inputStyle} value={x.date ?? ''} placeholder="YYYY-MM-DD" onChangeText={(v) => set({ date: v })} /></Field>
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
          <ThemedText themeColor="textSecondary" style={[styles.hint, sumMatches && { color: Brand.success }]}>
            {sumMatches ? t('Items match the total.') : t('Items add up to %sum%, receipt total is %total%.', { sum: formatMoney(sum), total: formatMoney(x.total) })}
          </ThemedText>
        ) : null}

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={onSave}>
          <Ionicons name="checkmark-circle" color="#fff" size={22} />
          <ThemedText style={styles.saveText}>{saving ? t('Saving…') : t('Save')}</ThemedText>
        </Pressable>
        <Pressable style={styles.cancel} onPress={() => { clearPending(); router.back(); }}>
          <ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText>
        </Pressable>
      </ScrollView>
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
  photo: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#00000010' },
  hint: { textAlign: 'center' },
  card: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  lowConfidence: { borderWidth: 2, borderColor: Brand.warning },
  field: { gap: 4 },
  twoCol: { flexDirection: 'row', gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  bold: { fontWeight: '700' },
  itemRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  qty: { width: 62, textAlign: 'right' },
  price: { width: 92, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: Brand.primary, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipActive: { backgroundColor: Brand.primary },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.two },
  saveBtn: {
    flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.success, borderRadius: 14, paddingVertical: 14,
  },
  saveText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
