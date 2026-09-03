// Quick add — a price seen at an informal market (no receipt). Shared anonymously via the RPC.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { allCities, informalMarkets, quickAddPrice, type CityRow } from '@/features/prices/api';
import { CityPicker } from '@/features/prices/components/city-picker';
import '@/features/prices/i18n';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { parseNumber } from '@/lib/numbers';

const CURRENCIES = ['MZN', 'ZAR', 'USD'];
/** Off for launch — see supabase/migrations/008_disable_quick_add.sql (the RPC is revoked server-side too). */
const QUICK_ADD_ENABLED = false;

export default function QuickAddScreen() {
  useLang();
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ name?: string }>();
  const [name, setName] = useState(params.name ?? '');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [currency, setCurrency] = useState('MZN');
  const [store, setStore] = useState('');
  const [city, setCity] = useState<CityRow | null>(null);
  const [size, setSize] = useState('');
  const [cities, setCities] = useState<CityRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [storeFocused, setStoreFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { allCities().then(setCities).catch(() => {}); }, []);
  useEffect(() => {
    if (!storeFocused) { setSuggestions([]); return; }
    const h = setTimeout(() => informalMarkets(store).then(setSuggestions).catch(() => {}), 200);
    return () => clearTimeout(h);
  }, [store, storeFocused]);

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];
  const priceNum = parseNumber(price) ?? NaN;
  const qtyNum = parseNumber(qty) || 1;
  const valid = name.trim().length >= 2 && Number.isFinite(priceNum) && priceNum > 0 && store.trim().length >= 2 && !!city;

  // Switched off for launch (see supabase/migrations/008_disable_quick_add.sql): the screen is not linked
  // from anywhere, but a deep link (izicost://quick-add) could still open it, so say so instead of failing.
  if (!QUICK_ADD_ENABLED) {
    return (
      <ThemedView style={[styles.container, { alignItems: 'center', justifyContent: 'center', gap: Spacing.two }]}>
        <Stack.Screen options={{ title: t('Add a market price') }} />
        <Ionicons name="time-outline" size={40} color={Brand.primary} />
        <ThemedText type="smallBold" style={{ fontSize: 17, textAlign: 'center' }}>{t('Market prices are coming later')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {t('For now, community prices come only from scanned receipts, which are hard to fake. Scan a receipt to add prices.')}
        </ThemedText>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: Spacing.two }}><ThemedText style={{ color: Brand.primary, fontWeight: '700' }}>{t('Close')}</ThemedText></Pressable>
      </ThemedView>
    );
  }

  async function save() {
    if (!valid || !city) { Alert.alert(t('Check the form'), t('Product, price, market and city are required.')); return; }
    setSaving(true);
    try {
      const res = await quickAddPrice({ name, price: priceNum, currency, storeName: store, city: city.city, qty: qtyNum, size });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(t('Price added — thank you!'), t('It is shared anonymously and will show once a second report confirms it.'), [
        { text: t('Add another'), onPress: () => { setName(''); setPrice(''); setQty('1'); setSize(''); } },
        { text: t('View product'), onPress: () => router.replace({ pathname: '/product/[key]', params: { key: res.product_key } }) },
      ]);
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      Alert.alert(t('Could not save'), msg === 'rate_limit' ? t('You have reached the limit of 30 prices per day. Please try again tomorrow.') : msg);
    } finally { setSaving(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('Add a market price') }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView type="backgroundElement" style={styles.note}>
          <Ionicons name="people" size={18} color={Brand.primary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            {t('For markets and stalls that give no receipt. Only the product, price, market, city and date are shared — never who you are.')}
          </ThemedText>
        </ThemedView>

        <Field label={t('Product')}>
          <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder={t('e.g. Tomatoes 1kg, Rice 5kg, Coca-Cola 2L')} placeholderTextColor="#888" autoCapitalize="sentences" />
        </Field>
        <View style={styles.row}>
          <Field label={t('Price')} flex={2}>
            <TextInput style={[inputStyle, styles.big]} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#888" />
          </Field>
          <Field label={t('Qty')} flex={1}>
            <TextInput style={inputStyle} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="1" placeholderTextColor="#888" />
          </Field>
        </View>
        <Field label={t('Currency')}>
          <View style={styles.chips}>
            {CURRENCIES.map((c) => (
              <Pressable key={c} onPress={() => setCurrency(c)} style={[styles.chip, { backgroundColor: c === currency ? Brand.primary : theme.backgroundElement }]}>
                <ThemedText type="smallBold" style={{ color: c === currency ? '#fff' : theme.textSecondary }}>{c}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Field>
        <Field label={t('Market or stall')}>
          <TextInput
            style={inputStyle} value={store} onChangeText={setStore} placeholder={t('e.g. Mercado Central, Xipamanine')} placeholderTextColor="#888"
            onFocus={() => setStoreFocused(true)} onBlur={() => setTimeout(() => setStoreFocused(false), 150)}
          />
          {storeFocused && suggestions.length ? (
            <ThemedView type="backgroundElement" style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable key={s.id} onPress={() => { setStore(s.name); if (s.city) setCity((c) => c ?? cities.find((x) => x.city === s.city) ?? { city: s.city!, country: null }); setStoreFocused(false); }} style={styles.suggestion}>
                  <Ionicons name="storefront-outline" size={16} color={Brand.primary} />
                  <ThemedText type="small" style={{ flex: 1 }}>{s.name}</ThemedText>
                  {s.city ? <ThemedText type="small" themeColor="textSecondary">{s.city}</ThemedText> : null}
                </Pressable>
              ))}
            </ThemedView>
          ) : null}
        </Field>
        <Field label={t('City')}>
          <Pressable onPress={() => setPickerOpen(true)} style={[inputStyle, styles.pickerBtn]}>
            <ThemedText style={{ flex: 1 }} themeColor={city ? 'text' : 'textSecondary'}>{city?.city ?? t('Choose a city')}</ThemedText>
            <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
        </Field>
        <Field label={t('Size (optional)')}>
          <TextInput style={inputStyle} value={size} onChangeText={setSize} placeholder={t('e.g. 1kg, 500g, 2L, 12 un')} placeholderTextColor="#888" autoCapitalize="none" />
        </Field>

        <Pressable onPress={save} disabled={saving || !valid} style={[styles.save, { opacity: saving || !valid ? 0.5 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={22} color="#fff" />}
          <ThemedText style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{saving ? t('Saving…') : t('Save')}</ThemedText>
        </Pressable>
      </ScrollView>
      <CityPicker visible={pickerOpen} title={t('City')} cities={cities} onClose={() => setPickerOpen(false)} onSelect={(c) => { setCity(c); setPickerOpen(false); }} />
    </KeyboardAvoidingView>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <View style={{ gap: 6, flex }}>
      <ThemedText type="smallBold" themeColor="textSecondary">{label}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  note: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, padding: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  big: { fontSize: 24, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: Spacing.two },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  suggestions: { borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: 12, paddingVertical: 10 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center' },
  save: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, backgroundColor: Brand.primary, borderRadius: 16, paddingVertical: 16, marginTop: Spacing.two },
});
