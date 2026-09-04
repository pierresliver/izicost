// My basket — several shopping lists (switch, create, rename, merge, delete); say it or type it (catalogue
// autocomplete), qty, tick, delete → "Where is it cheapest?".
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import {
  addItem, createList, deleteList, getActiveList, listItems, listLists, mergeLists, removeChecked, removeItem, renameList, searchProducts, setActiveList, updateItem,
  type BasketItem, type BasketList, type ProductHit,
} from '@/features/basket/api';
import { BasketItemRow } from '@/features/basket/components/basket-item-row';
import { VoiceSheet, type VoicePhase } from '@/features/basket/components/voice-sheet';
import '@/features/basket/i18n';
import { parseShoppingList, ParseLimitError, type MatchedItem } from '@/features/basket/parse';
import { ALERTS_HREF, BASKET_QUOTE_HREF } from '@/features/basket/routes';
import { loadVoiceLang, saveVoiceLang, useVoiceInput, type VoiceError, type VoiceLang } from '@/features/basket/voice';
import { PromptModal } from '@/features/prices/components/prompt-modal';
import { sizeLabel } from '@/features/prices/format';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';

type ListRow = BasketList & { item_count: number };

export default function BasketScreen() {
  const { lang } = useLang();
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ voice?: string }>();
  const [lists, setLists] = useState<ListRow[]>([]);
  const [list, setList] = useState<BasketList | null>(null);
  const [items, setItems] = useState<BasketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [adding, setAdding] = useState(false);
  const [prompt, setPrompt] = useState<'new' | 'rename' | null>(null);
  const [menuFor, setMenuFor] = useState<ListRow | null>(null); // the list whose menu is open (not always the active one)
  const [renameTarget, setRenameTarget] = useState<BasketList | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergePick, setMergePick] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // voice flow
  const [sheet, setSheet] = useState<VoicePhase | null>(null);
  const [voiceLang, setVoiceLang] = useState<VoiceLang>(lang);
  useEffect(() => { loadVoiceLang(lang).then(setVoiceLang); }, [lang]);
  const [parsed, setParsed] = useState<MatchedItem[]>([]);
  const [parseFallback, setParseFallback] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const autoStarted = useRef(false);
  const sessionRef = useRef(0); // a parse that finishes after Cancel / "Speak again" belongs to an old session

  const load = useCallback(async (which?: BasketList) => {
    try {
      const l = which ?? await getActiveList();
      const [its, all] = await Promise.all([listItems(l.id), listLists()]);
      setList(l); setItems(its); setLists(all); setError(null);
    } catch (e) { setError(String((e as Error).message ?? e)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function switchList(l: BasketList) {
    await setActiveList(l.id);
    setLoading(true);
    await load(l);
  }

  useEffect(() => {
    if (text.trim().length < 2) return;
    const h = setTimeout(() => searchProducts(text).then(setHits).catch(() => setHits([])), 200);
    return () => clearTimeout(h);
  }, [text]);
  const visibleHits = text.trim().length < 2 ? [] : hits;

  const onTranscript = useCallback(async (transcript: string) => {
    const session = sessionRef.current;
    setSheet('parsing');
    try {
      const { items: found, fallback } = await parseShoppingList(transcript, voiceLang);
      if (session !== sessionRef.current) return;
      setParseFallback(fallback);
      if (!found.length) { setVoiceMsg(t('No products were recognised in what you said. Try again, a little slower.')); setSheet('error'); return; }
      setParsed(found); setSheet('review');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      if (session !== sessionRef.current) return;
      setVoiceMsg(e instanceof ParseLimitError ? t('You have used today’s voice lists. Type your items instead.') : String((e as Error).message ?? e));
      setSheet('error');
    }
  }, [voiceLang]);
  const onVoiceError = useCallback((code: VoiceError) => {
    const messages: Record<VoiceError, string> = {
      'not-allowed': t('Microphone permission is needed. Allow it in the phone settings, or type your list.'),
      'unavailable': t('Speech recognition is not available on this phone. You can type your list instead.'),
      'no-speech': t('Nothing was heard. Hold the phone closer and try again.'),
      'network': t('The speech service needs internet on this phone. Try again when you are online, or type your list.'),
      'other': t('Something went wrong with the microphone. Try again.'),
    };
    setVoiceMsg(messages[code]); setSheet('error');
  }, []);
  const voice = useVoiceInput(onTranscript, onVoiceError);
  const { start: voiceStart, cancel: voiceCancel } = voice;

  const startVoice = useCallback(() => {
    Keyboard.dismiss();
    sessionRef.current += 1;
    setParsed([]); setVoiceMsg(null); setParseFallback(false);
    setSheet('listening');
    voiceStart(voiceLang);
  }, [voiceStart, voiceLang]);
  function changeVoiceLang(l: VoiceLang) {
    setVoiceLang(l); saveVoiceLang(l);
    if (sheet === 'listening') voice.resume(l);
  }
  const phase: VoicePhase = sheet === 'listening' && voice.status === 'paused' ? 'paused' : (sheet ?? 'listening');
  useEffect(() => {
    if (params.voice === '1' && !autoStarted.current) { autoStarted.current = true; startVoice(); }
  }, [params.voice, startVoice]);
  function cancelVoice() { sessionRef.current += 1; voiceCancel(); setSheet(null); }

  async function addAllParsed() {
    if (addingAll || !parsed.length) return;
    setAddingAll(true);
    try {
      const l = list ?? await getActiveList();
      if (!list) setList(l);
      for (const it of parsed) {
        await addItem(l.id, { name: it.product ? it.product.display_name : it.label, productId: it.product?.id ?? null, qty: it.qty });
        setParsed((cur) => cur.filter((x) => x !== it));
      }
      setItems(await listItems(l.id));
      setSheet(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.push(BASKET_QUOTE_HREF);
    } catch (e) { Alert.alert(t('Error'), String((e as Error).message ?? e)); }
    finally { setAddingAll(false); }
  }

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

  // ── list management ─────────────────────────────────────────────────────────────────────────
  /** Server messages the user may actually see, in their language. */
  function friendly(e: unknown): string {
    const msg = String((e as Error)?.message ?? e);
    if (/at most 20 lists|too many lists/i.test(msg)) return t('You can keep at most 20 lists.');
    if (/at most 200 items/i.test(msg)) return t('A list holds at most 200 items.');
    if (/not your list/i.test(msg)) return t('That list is not yours.');
    return msg;
  }
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await load(); Haptics.selectionAsync().catch(() => {}); }
    catch (e) { Alert.alert(t('Error'), friendly(e)); }
    finally { setBusy(false); }
  }
  function confirmDelete(target: ListRow) {
    Alert.alert(t('Delete list'), t('Delete “%name%” and its %n% items?', { name: target.name, n: target.id === list?.id ? items.length : target.item_count }), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: () => run(async () => { await deleteList(target.id); if (target.id === list?.id) setList(null); }) },
    ]);
  }
  /** Menu for one list (Android alerts allow only three buttons, so this is a small sheet). */
  function listMenu(target?: ListRow) {
    const l = target ?? lists.find((x) => x.id === list?.id);
    if (l) setMenuFor(l);
  }
  function openMerge() {
    if (lists.length < 2) { Alert.alert(t('Merge lists'), t('You need at least two lists to merge.')); return; }
    setMergePick(new Set()); setMergeOpen(true);
  }
  async function doMerge() {
    if (!list || !mergePick.size) return;
    setMergeOpen(false);
    await run(async () => {
      const n = await mergeLists(list.id, [...mergePick]);
      Alert.alert(t('Merge lists'), t('%n% items moved.', { n }));
    });
  }

  const checked = items.filter((i) => i.checked).length;
  const header = (
    <View style={{ gap: Spacing.two, marginBottom: Spacing.two }}>
      {/* lists bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }} style={{ flex: 1 }}>
          {lists.map((l) => {
            const on = l.id === list?.id;
            return (
              <Pressable key={l.id} onPress={() => (on ? listMenu(l) : switchList(l))} onLongPress={() => listMenu(l)} style={[styles.chip, { backgroundColor: on ? Brand.primary : theme.backgroundElement }]}>
                <ThemedText type="small" style={{ color: on ? '#fff' : theme.text, fontWeight: on ? '700' : '500' }} numberOfLines={1}>{l.name}</ThemedText>
                <View style={[styles.count, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : theme.backgroundSelected }]}>
                  <ThemedText type="small" style={{ color: on ? '#fff' : theme.textSecondary, fontSize: 11, lineHeight: 14 }}>{on ? items.length : l.item_count}</ThemedText>
                </View>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setPrompt('new')} style={[styles.chip, { backgroundColor: theme.backgroundElement }]} accessibilityLabel={t('New list')}>
            <Ionicons name="add" size={16} color={Brand.primary} />
            <ThemedText type="small" style={{ color: Brand.primary, fontWeight: '700' }}>{t('New list')}</ThemedText>
          </Pressable>
        </ScrollView>
        <Pressable onPress={() => listMenu()} hitSlop={8} accessibilityLabel={t('Lists')}><Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} /></Pressable>
      </View>

      <View style={[styles.input, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="add-circle-outline" size={20} color={Brand.primary} />
        <TextInput
          maxLength={120}
          style={[styles.inputText, { color: theme.text }]} value={text} onChangeText={setText}
          placeholder={t('Add an item, e.g. rice 5kg')} placeholderTextColor="#888" autoCorrect={false} returnKeyType="done"
          onSubmitEditing={() => add(text)} blurOnSubmit={false}
        />
        {text.trim() ? (
          <Pressable onPress={() => { add(text); Keyboard.dismiss(); }} style={styles.addBtn} disabled={adding}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('Add')}</ThemedText>
          </Pressable>
        ) : (
          <Pressable onPress={startVoice} style={styles.micBtn} accessibilityLabel={t('Say your list')} hitSlop={6}>
            <Ionicons name="mic" size={20} color="#fff" />
          </Pressable>
        )}
      </View>
      {visibleHits.length ? (
        <ThemedView type="backgroundElement" style={styles.suggest}>
          {visibleHits.map((h) => (
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
        {busy ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
        {checked ? <Pressable onPress={clearChecked} hitSlop={8}><ThemedText type="small" style={{ color: Brand.primary }}>{t('Clear ticked items')}</ThemedText></Pressable> : null}
      </View>
    </View>
  );

  const others = lists.filter((l) => l.id !== list?.id);
  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: list?.name ?? t('My basket') }} />
      <FlatList
        data={items} keyExtractor={(i) => i.id} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <ActivityIndicator color={Brand.primary} style={{ marginTop: Spacing.four }} /> : (
          <View style={styles.empty}>
            <Pressable onPress={startVoice} style={({ pressed }) => [styles.emptyMic, pressed && { opacity: 0.85 }]} accessibilityLabel={t('Say your list')}>
              <Ionicons name="mic" size={34} color="#fff" />
            </Pressable>
            <ThemedText type="smallBold" style={{ fontSize: 17, textAlign: 'center' }}>{error ? t('Could not load your basket') : t('Say what you need to buy')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {error ?? t('Tap the microphone and say your list, or type it above. Then we show you which store sells it all cheapest.')}
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

      <VoiceSheet
        visible={sheet !== null} phase={phase} transcript={voice.transcript} lang={voiceLang} onLang={changeVoiceLang} items={parsed} error={voiceMsg} fallback={parseFallback} busy={addingAll}
        onDone={voice.finish} onMore={() => voice.resume()} onCancel={cancelVoice} onRetry={startVoice}
        onRemove={(i) => setParsed((cur) => cur.filter((_, j) => j !== i))} onConfirm={addAllParsed}
      />
      <PromptModal
        key={prompt ?? 'none'} visible={prompt !== null}
        title={prompt === 'new' ? t('New list') : t('Rename list')} placeholder={t('List name, e.g. Weekly shop')}
        initialValue={prompt === 'rename' ? renameTarget?.name : undefined}
        onClose={() => setPrompt(null)}
        onSubmit={(v) => { const which = prompt; const target = renameTarget; setPrompt(null); run(async () => { if (which === 'new') await createList(v); else if (target) await renameList(target.id, v); }); }}
      />
      <Modal visible={menuFor !== null} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuFor(null)} />
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <ThemedText type="smallBold" style={{ fontSize: 17 }} numberOfLines={1}>{menuFor?.name}</ThemedText>
          {[
            { icon: 'add-circle-outline' as const, label: t('New list'), onPress: () => { setMenuFor(null); setPrompt('new'); } },
            { icon: 'pencil-outline' as const, label: t('Rename list'), onPress: () => { const target = menuFor; setMenuFor(null); setRenameTarget(target); setPrompt('rename'); } },
            { icon: 'git-merge-outline' as const, label: t('Merge lists'), onPress: () => { const target = menuFor; setMenuFor(null); if (target && target.id !== list?.id) switchList(target).then(openMerge); else openMerge(); } },
            ...(lists.length > 1 ? [{ icon: 'trash-outline' as const, label: t('Delete list'), danger: true, onPress: () => { const target = menuFor; setMenuFor(null); if (target) confirmDelete(target); } }] : []),
          ].map((o) => (
            <Pressable key={o.label} onPress={o.onPress} style={styles.menuRow}>
              <Ionicons name={o.icon} size={20} color={'danger' in o && o.danger ? Brand.danger : Brand.primary} />
              <ThemedText style={'danger' in o && o.danger ? { color: Brand.danger } : undefined}>{o.label}</ThemedText>
            </Pressable>
          ))}
          <Pressable onPress={() => setMenuFor(null)} style={{ alignItems: 'center', paddingVertical: Spacing.two }}><ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText></Pressable>
        </View>
      </Modal>
      <Modal visible={mergeOpen} transparent animationType="fade" onRequestClose={() => setMergeOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMergeOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <ThemedText type="smallBold" style={{ fontSize: 17 }}>{t('Merge into “%name%”', { name: list?.name ?? '' })}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('Choose the lists to merge into the current one. Same items add up; the merged lists are removed.')}</ThemedText>
          {others.map((l) => {
            const on = mergePick.has(l.id);
            return (
              <Pressable key={l.id} onPress={() => setMergePick((cur) => { const n = new Set(cur); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} style={styles.mergeRow}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? Brand.primary : theme.textSecondary} />
                <ThemedText style={{ flex: 1 }}>{l.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{l.item_count} {t('items')}</ThemedText>
              </Pressable>
            );
          })}
          <Pressable onPress={doMerge} disabled={!mergePick.size} style={[styles.cta, { paddingVertical: 12 }, !mergePick.size && { opacity: 0.45 }]}>
            <Ionicons name="git-merge-outline" size={18} color="#fff" />
            <ThemedText style={{ color: '#fff', fontWeight: '700' }}>{t('Merge %n% lists', { n: mergePick.size })}</ThemedText>
          </Pressable>
          <Pressable onPress={() => setMergeOpen(false)} style={{ alignItems: 'center', paddingVertical: Spacing.two }}><ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText></Pressable>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: 140 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 220 },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  input: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, paddingLeft: 12, paddingRight: 6, height: 52 },
  inputText: { flex: 1, fontSize: 16, paddingVertical: 0 },
  addBtn: { backgroundColor: Brand.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  micBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  suggest: { borderRadius: 14, paddingVertical: 4 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10, paddingHorizontal: 12 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  emptyMic: { width: 84, height: 84, borderRadius: 42, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, backgroundColor: Brand.primary, borderRadius: 16, paddingVertical: 16,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  backdrop: { flex: 1, backgroundColor: '#00000066' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  mergeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 12 },
});
