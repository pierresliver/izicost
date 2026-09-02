import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { t, useLang } from '@/lib/i18n';
import { deleteReceipt, formatMoney, getReceipt, signedImageUrl } from '@/lib/receipts';
import type { ReceiptItemRow, ReceiptRow } from '@/lib/types';

export default function ReceiptDetail() {
  useLang();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [receipt, setReceipt] = useState<(ReceiptRow & { notes: string | null; store_tax_id: string | null; tax_total: number | null }) | null>(null);
  const [items, setItems] = useState<ReceiptItemRow[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getReceipt(id)
      .then(async ({ receipt, items }) => {
        setReceipt(receipt); setItems(items);
        if (receipt.image_path) setPhoto(await signedImageUrl(receipt.image_path));
      })
      .catch((e) => setError(String((e as Error).message ?? e)));
  }, [id]);

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
  if (!receipt) return <ThemedView style={styles.container} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="title">{receipt.store_name ?? '?'}</ThemedText>
        {receipt.store_branch_address ? <ThemedText themeColor="textSecondary">{receipt.store_branch_address}</ThemedText> : null}
        <ThemedText themeColor="textSecondary">{receipt.purchased_on ?? '—'} · {receipt.payment_method ? t(receipt.payment_method) : t('unknown')}</ThemedText>
        {receipt.store_tax_id ? <ThemedText type="small" themeColor="textSecondary">NUIT/VAT {receipt.store_tax_id}</ThemedText> : null}
        <ThemedText type="title" style={{ marginTop: Spacing.two }}>{formatMoney(receipt.total, receipt.currency)}</ThemedText>
      </ThemedView>

      <ThemedText type="subtitle">{t('Items')} ({items.length})</ThemedText>
      <ThemedView type="backgroundElement" style={styles.card}>
        {items.map((it) => (
          <View key={it.id} style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.qty}>{it.qty ?? ''}</ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText>{it.name_as_printed}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{t(it.category ?? 'other')}{it.subcategory ? ` · ${it.subcategory.replace(/_/g, ' ')}` : ''}</ThemedText>
            </View>
            <ThemedText>{formatMoney(it.line_total)}</ThemedText>
          </View>
        ))}
      </ThemedView>

      {receipt.notes ? <ThemedText type="small" themeColor="textSecondary">{receipt.notes}</ThemedText> : null}

      <ThemedText type="subtitle">{t('Photo')}</ThemedText>
      {photo ? <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" /> : null}

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
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', paddingVertical: 6 },
  qty: { width: 40, textAlign: 'right' },
  photo: { width: '100%', height: 520, borderRadius: 12, backgroundColor: '#00000010' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three },
});
