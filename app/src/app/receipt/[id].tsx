import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { splitImagePaths } from '@/features/scan/api';
import { PhotoStrip } from '@/features/scan/components/photo-strip';
import { PhotoViewer } from '@/features/scan/components/photo-viewer';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { deleteReceipt, formatMoney, getReceipt, signedImageUrl, updateItemCategory } from '@/lib/receipts';
import { CATEGORIES, type ReceiptItemRow, type ReceiptRow } from '@/lib/types';

export default function ReceiptDetail() {
  useLang();
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [receipt, setReceipt] = useState<(ReceiptRow & { notes: string | null; store_tax_id: string | null; tax_total: number | null }) | null>(null);
  const [items, setItems] = useState<ReceiptItemRow[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosMissing, setPhotosMissing] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // item id whose category chips are open
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getReceipt(id)
      .then(async ({ receipt, items }) => {
        setReceipt(receipt); setItems(items);
        const paths = splitImagePaths(receipt.image_path);
        const urls = await Promise.all(paths.map((p) => signedImageUrl(p)));
        const ok = urls.filter((u): u is string => Boolean(u));
        setPhotos(ok);
        setPhotosMissing(paths.length > 0 && ok.length === 0);
      })
      .catch((e) => setError(String((e as Error).message ?? e)));
  }, [id]);

  async function changeCategory(item: ReceiptItemRow, category: string) {
    if (item.category === category) { setEditing(null); return; }
    const before = items;
    // subcategory belonged to the old category: drop it rather than show "household · red_meat"
    setItems((cur) => cur.map((it) => (it.id === item.id ? { ...it, category, subcategory: null } : it)));
    setEditing(null);
    try {
      await updateItemCategory(item.id, category, null);
      Haptics.selectionAsync().catch(() => {});
    } catch (e) {
      setItems(before);
      Alert.alert(t('Could not save'), String((e as Error).message ?? e));
    }
  }

  function onDelete() {
    if (!receipt) return;
    Alert.alert(t('Delete this receipt?'), t('This cannot be undone.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'), style: 'destructive',
        onPress: async () => {
          try { await deleteReceipt(receipt.id, receipt.image_path); router.back(); }
          catch (e) { Alert.alert(t('Could not delete'), String((e as Error).message ?? e)); }
        },
      },
    ]);
  }

  if (error) return <ThemedView style={styles.container}><ThemedText style={{ color: Brand.danger }}>{error}</ThemedText></ThemedView>;
  if (!receipt) return <ThemedView style={styles.container}><ActivityIndicator color={Brand.primary} /></ThemedView>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.storeName}>{receipt.store_name ?? '?'}</ThemedText>
        {receipt.store_branch_address ? <ThemedText themeColor="textSecondary">{receipt.store_branch_address}</ThemedText> : null}
        <ThemedText themeColor="textSecondary">{receipt.purchased_on ?? '—'} · {receipt.payment_method ? t(receipt.payment_method) : t('unknown')}</ThemedText>
        {receipt.store_tax_id ? <ThemedText type="small" themeColor="textSecondary">NUIT/VAT {receipt.store_tax_id}</ThemedText> : null}
        <ThemedText style={styles.total}>{formatMoney(receipt.total, receipt.currency)}</ThemedText>
      </ThemedView>

      <View style={styles.sectionRow}>
        <ThemedText type="smallBold" style={styles.section}>{t('Items')} ({items.length})</ThemedText>
        {items.length ? <ThemedText type="small" themeColor="textSecondary">{t('Tap an item to change its category')}</ThemedText> : null}
      </View>
      <ThemedView type="backgroundElement" style={styles.card}>
        {items.map((it) => {
          const open = editing === it.id;
          return (
            <View key={it.id}>
              <Pressable onPress={() => setEditing(open ? null : it.id)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.qty}>{it.qty ?? ''}</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText>{it.name_as_printed}</ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <ThemedText type="small" style={{ color: Brand.primary }}>{t(it.category ?? 'other')}</ThemedText>
                    {it.subcategory ? <ThemedText type="small" themeColor="textSecondary">· {it.subcategory.replace(/_/g, ' ')}</ThemedText> : null}
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={theme.textSecondary} />
                  </View>
                </View>
                <ThemedText>{formatMoney(it.line_total)}</ThemedText>
              </Pressable>
              {open ? (
                <View style={styles.chips}>
                  {CATEGORIES.map((c) => {
                    const active = it.category === c;
                    return (
                      <Pressable key={c} onPress={() => changeCategory(it, c)} style={[styles.chip, { backgroundColor: active ? Brand.primary : theme.backgroundSelected }]}>
                        <ThemedText type="small" style={{ color: active ? '#fff' : theme.text, fontWeight: active ? '700' : '500' }}>{t(c)}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </ThemedView>

      {receipt.notes ? <ThemedText type="small" themeColor="textSecondary">{receipt.notes}</ThemedText> : null}

      <ThemedText type="smallBold" style={styles.section}>{photos.length > 1 ? `${t('Photo')} (${photos.length})` : t('Photo')}</ThemedText>
      {photos.length ? <PhotoStrip uris={photos} height={photos.length > 1 ? 200 : 420} onPress={setViewer} fillSingle /> : null}
      {photosMissing ? (
        <ThemedView type="backgroundElement" style={[styles.card, styles.missingPhoto]}>
          <Ionicons name="image-outline" size={28} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {t('The photo of this receipt is no longer available. The items and totals are kept.')}
          </ThemedText>
        </ThemedView>
      ) : null}
      <PhotoViewer uris={photos} index={viewer} onClose={() => setViewer(null)} />

      <Pressable style={styles.deleteBtn} onPress={onDelete}>
        <Ionicons name="trash" color={Brand.danger} size={18} />
        <ThemedText style={{ color: Brand.danger, fontWeight: '600' }}> {t('Delete')}</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { borderRadius: 14, padding: Spacing.three, gap: 4 },
  storeName: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  total: { fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: Spacing.two },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.two, flexWrap: 'wrap' },
  section: { fontSize: 17 },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', paddingVertical: 6 },
  qty: { width: 40, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 48, paddingBottom: Spacing.two },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  missingPhoto: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three },
});
