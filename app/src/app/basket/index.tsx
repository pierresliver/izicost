// My basket — the shopping list: add (with catalogue autocomplete), qty, tick, delete → "Where is it cheapest?".
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import {
  addItem, getDefaultList, listItems, removeChecked, removeItem, searchProducts, updateItem,
  type BasketItem, type BasketList, type ProductHit,
} from '@/features/basket/api';
import { BasketItemRow } from '@/features/basket/components/basket-item-row';
import '@/features/basket/i18n';
import { ALERTS_HREF, BASKET_QUOTE_HREF } from '@/features/basket/routes';
import { sizeLabel } from '@/features/prices/format';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';

export default function BasketScreen() {
  useLang();
  const router = useRouter();
  const theme = useTheme();
  const [list, setList] = useState<BasketList | null>(null);
  const [items, setItems] = useState<BasketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const l = list ?? await getDefaultList();
      if (!list) setList(l);
      setItems(await listItems(l.id)); setError(null);
    } catch (e) { setError(String((e as Error).message ?? e)); }
    finally { setLoading(false); }
  }, [list]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (text.trim().length < 2) { setHits([]); return; }
    const h = setTimeout(() => searchProducts(text).then(setHits).catch(() => setHits([])), 200);
    return () => clearTimeout(h);
  }, [text]);

  async function add(name: string, productId?: string | null) {
    if (!list || !name.trim() || adding) return;
    setAdding(true);
    try {
      const row = await addItem(list.id, { name, productId });
      setItems((cur) => (cur.some((i) => i.id === row.id) ? cur.map((i) => (i.id === row.id ? row : i)) : [...cur, row]));
      setText(''); setHits([]);
    } catch (e) { Alert.alert(t('Error'), String((e as Error).message ?? e)); }
    finally { setAdding(false); }
  }
  async function patch(item: BasketItem, p: { qty?: number; checked?: boolean }) {
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, ...p } : i)));
    try { await updateItem(item.id, p); } catch { load(); }
  }
  function remove(item: BasketItem) {
    Alert.alert(t('Remove %name%?', { name: item.name }), undefined, [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Remove'), style: 'destructive', onPress: async () => { setItems((c) => c.filter((i) => i.id !== item.id)); try { await removeItem(item.id); } catch { load(); } } },
    ]);
  }
  async function clearChecked() {
    if (!list) return;
    setItems((c) => c.filter((i) => !i.checked));
    try { await removeChecked(list.id); } catch { load(); }
  }

  const checked = items.filter((i) => i.checked).length;
  const header = (
    <View style={{ gap: Spacing.two, marginBottom: Spacing.two }}>
      <View style={[styles.input, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="add-circle-outline" size={20} color={Brand.primary} />
        <TextInput
          style={[styles.inputText, { color: theme.text }]} value={text} onChangeText={setText}
          placeholder={t('Add an item, e.g. rice 5kg')} placeholderTextColor="#888" autoCorrect={false} returnKeyType="done"
          onSubmitEditing={() => add(text)} blurOnSubmit={false}
        />
        {text.trim() ? (
          <Pressable onPress={() => { add(text); Keyboard.dismiss(); }} style={styles.addBtn} disabled={adding}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('Add')}</ThemedText>
          </Pressable>
        ) : null}
      </View>
      {hits.length ? (
        <ThemedView type="backgroundElement" style={styles.suggest}>
          {hits.map((h) => (
            <Pressable key={h.id} onPress={() => add(h.display_name, h.id)} style={({ pressed }) => [styles.suggestRow, pressed && { backgroundColor: theme.backgroundSelected }]}>
              <Ionicons name="pricetag-outline" size={14} color={Brand.primary} />
              <ThemedText type="small" style={{ flex: 1 }} numberOfLines={1}>{h.display_name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{sizeLabel(h.size_value, h.size_unit)}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.one }}>
        <ThemedText type="smallBold" style={{ fontSize: 16, flex: 1 }}>{items.length === 1 ? t('1 item') : t('%n% items', { n: items.length })}</ThemedText>
        {checked ? <Pressable onPress={clearChecked} hitSlop={8}><ThemedText type="small" style={{ color: Brand.primary }}>{t('Clear ticked items')}</ThemedText></Pressable> : null}
      </View>
    </View>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('My basket') }} />
      <FlatList
        data={items} keyExtractor={(i) => i.id} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <ActivityIndicator color={Brand.primary} style={{ marginTop: Spacing.four }} /> : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="basket" size={30} color={Brand.primary} /></View>
            <ThemedText type="smallBold" style={{ fontSize: 17, textAlign: 'center' }}>{error ? t('Could not load your basket') : t('Your basket is empty')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {error ?? t('Type what you need to buy. Products already known to the community get matched automatically.')}
            </ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <BasketItemRow
            item={item} onToggle={() => patch(item, { checked: !item.checked })} onQty={(qty) => patch(item, { qty })} onRemove={() => remove(item)}
            onOpen={item.product_key ? () => router.push({ pathname: '/product/[key]', params: { key: item.product_key! } }) : undefined}
          />
        )}
      />
      <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.backgroundElement }]}>
        <Pressable
          onPress={() => router.push(BASKET_QUOTE_HREF)} disabled={!items.length}
          style={({ pressed }) => [styles.cta, !items.length && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
          <Ionicons name="search" size={20} color="#fff" />
          <ThemedText style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{t('Where is it cheapest?')}</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.push(ALERTS_HREF)} style={styles.link} hitSlop={6}>
          <Ionicons name="notifications-outline" size={14} color={Brand.primary} />
          <ThemedText type="small" style={{ color: Brand.primary }}>{t('My alerts')}</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: 140 },
  input: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, paddingLeft: 12, paddingRight: 6, height: 48 },
  inputText: { flex: 1, fontSize: 16, paddingVertical: 0 },
  addBtn: { backgroundColor: Brand.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  suggest: { borderRadius: 14, paddingVertical: 4 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10, paddingHorizontal: 12 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(11,110,79,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, backgroundColor: Brand.primary, borderRadius: 16, paddingVertical: 16,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
});
