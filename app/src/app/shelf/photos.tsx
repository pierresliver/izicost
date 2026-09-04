// Shelf scan, step 3: check the photos. Blurry-looking ones are flagged and left out (tap to keep
// them anyway), then the kept ones are uploaded in batches and read by the server.
import '@/features/shelf/i18n';

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { isOnline, OfflineError, ScanLimitError } from '@/features/scan/api';
import { PhotoViewer } from '@/features/scan/components/photo-viewer';
import { MAX_SHELF_PHOTOS_PER_READ, readShelfPhotos, type ShelfItem, type ShelfPhotoNote } from '@/features/shelf/api';
import { getSession, updateSession, type Shot } from '@/features/shelf/session';
import { detailScore, flagBlurry } from '@/features/shelf/sharpness';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { prepareImage } from '@/lib/receipts';

export default function ShelfPhotosScreen() {
  useLang();
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const session = getSession();
  const [shots, setShots] = useState<Shot[]>(session?.shots ?? []);
  const [viewer, setViewer] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ batch: number; batches: number; step: string } | null>(null);
  const [adding, setAdding] = useState(false);

  if (!session) {
    return <ThemedView style={styles.screen}><Stack.Screen options={{ title: t('Shelf scan') }} /><ThemedText>{t('Nothing to save')}</ThemedText></ThemedView>;
  }

  const store = session.store; const currency = session.currency;
  const kept = shots.filter((s) => s.keep);
  const keptIdx = shots.map((s, i) => (s.keep ? i : -1)).filter((i) => i >= 0); // position in the grid of each kept photo
  const flagged = shots.filter((s) => s.blurry).length;
  const batches = Math.ceil(kept.length / MAX_SHELF_PHOTOS_PER_READ);
  const cell = Math.floor((width - Spacing.three * 2 - 8 * 2) / 3);

  function toggle(i: number) {
    setShots((list) => list.map((s, j) => (j === i ? { ...s, keep: !s.keep } : s)));
  }

  async function addFromGallery() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: 24, orderedSelection: true });
    if (res.canceled || !res.assets?.length) return;
    setAdding(true);
    try {
      const extra: Shot[] = [];
      for (const a of res.assets) {
        const uri = await prepareImage(a.uri);
        extra.push({ uri, score: await detailScore(uri), blurry: false, keep: true, takenAt: Date.now() });
      }
      const all = [...shots, ...extra];
      const blur = flagBlurry(all.map((s) => s.score));
      setShots(all.map((s, i) => ({ ...s, blurry: blur[i], keep: s.keep && !blur[i] })));
    } catch (e) {
      Alert.alert(t('Could not add those photos'), String((e as Error).message ?? e));
    } finally {
      setAdding(false);
    }
  }

  async function readAll() {
    if (!kept.length || progress) return;
    if (!(await isOnline())) { Alert.alert(t('No internet'), t('Your photos stay on this phone. Try again when you are back online.')); return; }
    const items: ShelfItem[] = [];
    const notes: ShelfPhotoNote[] = [];
    const seen = new Set<string>();
    let readCount = 0;
    try {
      for (let b = 0; b < batches; b++) {
        const slice = kept.slice(b * MAX_SHELF_PHOTOS_PER_READ, (b + 1) * MAX_SHELF_PHOTOS_PER_READ);
        setProgress({ batch: b + 1, batches, step: 'upload' });
        const r = await readShelfPhotos(slice.map((s) => s.uri), { storeName: store.name, currency }, (n, total) => {
          setProgress({ batch: b + 1, batches, step: n < total ? 'upload' : 'read' });
        });
        setProgress({ batch: b + 1, batches, step: 'read' });
        for (const it of r.items) {
          const key = `${it.name.trim().toLowerCase()}|${it.price}`;
          if (seen.has(key)) continue; // the same label caught in two batches
          seen.add(key);
          const inKept = b * MAX_SHELF_PHOTOS_PER_READ + Math.max(0, Math.min(slice.length - 1, it.photo_index | 0));
          items.push({ ...it, photo_index: keptIdx[inKept] ?? 0 }); // numbered like the grid
        }
        for (const n of r.photos) notes.push({ ...n, index: keptIdx[b * MAX_SHELF_PHOTOS_PER_READ + (n.index | 0)] ?? 0 });
        readCount += slice.length;
      }
      updateSession({ shots, items, photoNotes: notes, photosRead: readCount });
      setProgress(null);
      router.replace('/shelf/review');
    } catch (e) {
      setProgress(null);
      if (items.length) {
        // Later batches failed: keep what was read rather than losing the walk.
        updateSession({ shots, items, photoNotes: notes, photosRead: readCount });
        Alert.alert(t('Partly read'), t('%n% photos were read before the connection dropped. You can publish those now.', { n: readCount }), [
          { text: t('OK'), onPress: () => router.replace('/shelf/review') },
        ]);
        return;
      }
      if (e instanceof ScanLimitError) Alert.alert(t('Scan limit reached'), t('You have reached today’s shelf photo limit. Try again tomorrow.'));
      else if (e instanceof OfflineError) Alert.alert(t('No internet'), t('Your photos stay on this phone. Try again when you are back online.'));
      else Alert.alert(t('Could not read the shelves'), String((e as Error).message ?? e));
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('Check the photos') }} />
      <ScrollView contentContainerStyle={styles.screen}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">{session.store.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('%kept% of %total% photos will be read.', { kept: kept.length, total: shots.length })}{flagged ? ` ${t('%n% look blurry and are left out; tap one to keep it.', { n: flagged })}` : ''}
          </ThemedText>
          {kept.length ? <ThemedText type="small" themeColor="textSecondary">{batches === 1 ? t('About 20 seconds to read.') : t('%n% batches, about %s% seconds.', { n: batches, s: batches * 20 })}</ThemedText> : null}
        </ThemedView>

        <View style={styles.grid}>
          {shots.map((s, i) => (
            <Pressable key={s.uri} onPress={() => toggle(i)} onLongPress={() => setViewer(i)} accessibilityRole="button" accessibilityLabel={`${i + 1} · ${s.keep ? t('Read') : s.blurry ? t('Blurry?') : t('Skip')}`} style={[styles.cell, { width: cell, height: Math.round(cell * 1.25), borderColor: s.keep ? Brand.success : s.blurry ? Brand.warning : theme.backgroundSelected }]}>
              <Image source={{ uri: s.uri }} style={[styles.img, !s.keep && { opacity: 0.35 }]} contentFit="cover" recyclingKey={s.uri} />
              <View style={[styles.tag, { backgroundColor: s.keep ? Brand.success : s.blurry ? Brand.warning : '#666' }]}>
                <Ionicons name={s.keep ? 'checkmark' : s.blurry ? 'eye-off-outline' : 'close'} size={12} color="#fff" />
                <ThemedText style={styles.tagText}>{s.keep ? t('Read') : s.blurry ? t('Blurry?') : t('Skip')}</ThemedText>
              </View>
              <View style={styles.num}><ThemedText style={styles.tagText}>{i + 1}</ThemedText></View>
            </Pressable>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{t('Tap to keep or skip · hold to enlarge')}</ThemedText>

        <Pressable style={[styles.secondaryBtn, adding && { opacity: 0.5 }]} disabled={adding || !!progress} onPress={addFromGallery}>
          {adding ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="images" size={20} color={Brand.primary} />}
          <ThemedText style={{ color: Brand.primary, fontWeight: '700' }}>{t('Add photos from the gallery')}</ThemedText>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.primaryBtn, (!kept.length || !!progress) && { opacity: 0.45 }, pressed && { opacity: 0.8 }]} disabled={!kept.length || !!progress} onPress={readAll}>
          <Ionicons name="sparkles" color="#fff" size={22} />
          <ThemedText style={styles.primaryBtnText}>{kept.length === 1 ? t('Read %n% photo', { n: 1 }) : t('Read %n% photos', { n: kept.length })}</ThemedText>
        </Pressable>
        <Pressable onPress={() => { updateSession({ shots }); router.replace('/shelf/capture'); }} style={{ alignItems: 'center', paddingVertical: Spacing.two }} disabled={!!progress}>
          <ThemedText themeColor="textSecondary">{t('Take more photos')}</ThemedText>
        </Pressable>
      </ScrollView>

      {progress ? (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: `${theme.background}F2` }]}>
          <View style={[styles.overlayCard, { backgroundColor: theme.backgroundElement }]}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <ThemedText style={{ fontWeight: '600', textAlign: 'center' }}>
              {progress.step === 'upload' ? t('Uploading batch %b% of %n%…', { b: progress.batch, n: progress.batches }) : t('Reading the labels in batch %b% of %n%…', { b: progress.batch, n: progress.batches })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{t('Photos are deleted from the server as soon as they are read.')}</ThemedText>
          </View>
        </View>
      ) : null}
      <PhotoViewer uris={shots.map((s) => s.uri)} index={viewer} onClose={() => setViewer(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { borderRadius: 16, padding: Spacing.three, gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { borderRadius: 12, overflow: 'hidden', borderWidth: 2, backgroundColor: '#00000018' },
  img: { width: '100%', height: '100%' },
  tag: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  num: { position: 'absolute', right: 6, top: 6, backgroundColor: '#00000088', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  primaryBtn: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.primary, borderRadius: 16, paddingVertical: 18 },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Brand.primary, borderRadius: 14, paddingVertical: 12 },
  overlay: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  overlayCard: { width: '100%', borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.three },
});
