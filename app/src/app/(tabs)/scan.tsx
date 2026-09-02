// Scan tab: the entry point. Opens the full-screen camera (or the gallery), runs the shared
// upload/read pipeline, and shows the offline queue with retry.
import '@/features/scan/i18n';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Network from 'expo-network';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { isOnline, MAX_PHOTOS } from '@/features/scan/api';
import { PhotoStrip } from '@/features/scan/components/photo-strip';
import { dequeueScan, loadQueue, subscribeQueue, type QueuedScan } from '@/features/scan/queue';
import { takeShots } from '@/features/scan/shots';
import { useScanPipeline, type Phase, type ScanNotice } from '@/features/scan/use-scan-pipeline';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';

export default function ScanScreen() {
  useLang();
  const router = useRouter();
  const theme = useTheme();
  const { phase, progress, photos, notice, run, clearNotice, notify, isRunning, busy } = useScanPipeline();
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [retrying, setRetrying] = useState(false);
  const skipAuto = useRef<Set<string>>(new Set()); // entries that failed for a non-network reason this session
  const limitHit = useRef(false);
  const focused = useRef(false);

  useEffect(() => {
    loadQueue().then(setQueue).catch(() => {});
    return subscribeQueue(setQueue);
  }, []);

  const retryQueue = useCallback(async (manual: boolean) => {
    if (isRunning()) return;
    if (!manual && limitHit.current) return;
    const q = await loadQueue();
    const entry = manual ? q[0] : q.find((e) => !skipAuto.current.has(e.id));
    if (!entry) return;
    if (!(await isOnline())) {
      if (manual) notify({ kind: 'queued', message: t('Saved — will be read when you are back online') });
      return;
    }
    setRetrying(true);
    const result = await run(entry.localUris, { prepared: true, queueId: entry.id });
    setRetrying(false);
    if (result === 'error') skipAuto.current.add(entry.id);
    if (result === 'limit') limitHit.current = true;
  }, [isRunning, notify, run]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const shots = takeShots();
      if (shots?.length) run(shots, { prepared: true });
      else retryQueue(false);
      const sub = Network.addNetworkStateListener((s) => {
        if (focused.current && s.isConnected && s.isInternetReachable !== false) retryQueue(false);
      });
      return () => { focused.current = false; sub.remove(); };
    }, [run, retryQueue]),
  );

  async function pickFromGallery() {
    clearNotice();
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS, orderedSelection: true,
    });
    if (res.canceled || !res.assets?.length) return;
    await run(res.assets.slice(0, MAX_PHOTOS).map((a) => a.uri));
  }

  function removeQueued(entry: QueuedScan) {
    Alert.alert(t('Remove this receipt from the queue?'), t('The photos will be deleted from this phone.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Remove'), style: 'destructive', onPress: () => dequeueScan(entry.id).catch(() => {}) },
    ]);
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView type="backgroundElement" style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="receipt" size={38} color="#fff" /></View>
          <ThemedText style={styles.heroTitle}>{t('Scan a receipt')}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.heroSub}>
            {t('One photo is enough. Long receipt? Take up to 4 photos, top to bottom.')}
          </ThemedText>
          <View style={styles.tips}>
            <Tip icon="layers-outline" label={t('Lay it flat')} bg={theme.backgroundSelected} />
            <Tip icon="sunny-outline" label={t('Good light')} bg={theme.backgroundSelected} />
            <Tip icon="flash-off-outline" label={t('No glare')} bg={theme.backgroundSelected} />
            <Tip icon="calculator-outline" label={t('Include the total')} bg={theme.backgroundSelected} />
          </View>
        </ThemedView>

        {notice ? <NoticeCard notice={notice} onDismiss={clearNotice} /> : null}

        {queue.length ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.queueHead}>
              <View style={styles.queueIcon}><Ionicons name="cloud-offline-outline" size={22} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.cardTitle}>
                  {queue.length === 1 ? t('%n% receipt waiting to be read', { n: 1 }) : t('%n% receipts waiting to be read', { n: queue.length })}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{t('Waiting for internet')}</ThemedText>
              </View>
              <View style={styles.badge}><ThemedText style={styles.badgeText}>{queue.length}</ThemedText></View>
            </View>
            {queue.map((entry) => (
              <View key={entry.id} style={styles.queueRow}>
                <Image source={{ uri: entry.localUris[0] }} style={styles.queueThumb} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <ThemedText>{new Date(entry.createdAt).toLocaleString()}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {entry.localUris.length} {entry.localUris.length === 1 ? t('photo') : t('photos')}
                  </ThemedText>
                </View>
                <Pressable onPress={() => removeQueued(entry)} hitSlop={10} accessibilityLabel={t('Remove')}>
                  <Ionicons name="trash-outline" size={22} color={Brand.danger} />
                </Pressable>
              </View>
            ))}
            <Pressable style={[styles.retryBtn, (retrying || busy) && styles.disabled]} disabled={retrying || busy} onPress={() => retryQueue(true)}>
              {retrying ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="refresh" size={20} color={Brand.primary} />}
              <ThemedText style={styles.retryText}>{retrying ? t('Retrying…') : t('Retry now')}</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        <Pressable style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, busy && styles.disabled]} disabled={busy} onPress={() => { clearNotice(); router.push('/camera'); }}>
          <Ionicons name="camera" color="#fff" size={24} />
          <ThemedText style={styles.btnText}>{t('Take a photo')}</ThemedText>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && { opacity: 0.7 }, busy && styles.disabled]} disabled={busy} onPress={pickFromGallery}>
          <Ionicons name="images" color={Brand.primary} size={22} />
          <ThemedText style={[styles.btnText, { color: Brand.primary }]}>{t('Choose from gallery')}</ThemedText>
        </Pressable>
      </ScrollView>

      {busy ? <ProcessingOverlay phase={phase} progress={progress} photos={photos} bg={theme.background} card={theme.backgroundElement} /> : null}
    </ThemedView>
  );
}

function Tip({ icon, label, bg }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; bg: string }) {
  return (
    <View style={[styles.tip, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={16} color={Brand.primary} />
      <ThemedText type="small">{label}</ThemedText>
    </View>
  );
}

function NoticeCard({ notice, onDismiss }: { notice: ScanNotice; onDismiss: () => void }) {
  const palette = {
    limit: { color: Brand.warning, icon: 'hourglass-outline' as const, title: t('Scan limit reached') },
    queued: { color: Brand.primary, icon: 'cloud-upload-outline' as const, title: t('Waiting for internet') },
    error: { color: Brand.danger, icon: 'alert-circle-outline' as const, title: t('Could not read this receipt') },
  }[notice.kind];
  return (
    <View style={[styles.notice, { borderColor: palette.color, backgroundColor: `${palette.color}1A` }]}>
      <Ionicons name={palette.icon} size={26} color={palette.color} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={{ fontWeight: '700', color: palette.color }}>{palette.title}</ThemedText>
        <ThemedText type="small">{notice.message}</ThemedText>
      </View>
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel={t('Close')}>
        <Ionicons name="close" size={20} color={palette.color} />
      </Pressable>
    </View>
  );
}

function ProcessingOverlay({ phase, progress, photos, bg, card }: { phase: Phase; progress: { n: number; total: number }; photos: string[]; bg: string; card: string }) {
  const label =
    phase === 'uploading' ? t('Uploading photo %n% of %total%…', { n: progress.n, total: progress.total })
    : phase === 'reading' ? t('Reading the receipt… about 10 seconds')
    : t('Checking your connection…');
  const steps: { key: Phase; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'preparing', icon: 'image-outline' }, { key: 'uploading', icon: 'cloud-upload-outline' }, { key: 'reading', icon: 'sparkles-outline' },
  ];
  const order: Phase[] = ['preparing', 'uploading', 'reading'];
  const idx = order.indexOf(phase);
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: `${bg}F2` }]}>
      <View style={[styles.overlayCard, { backgroundColor: card }]}>
        {photos.length ? <PhotoStrip uris={photos} height={150} fillSingle /> : null}
        <View style={styles.steps}>
          {steps.map((s, i) => {
            const done = i < idx; const active = i === idx;
            return (
              <View key={s.key} style={styles.step}>
                <View style={[styles.stepDot, (done || active) && { backgroundColor: Brand.primary }]}>
                  {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : <Ionicons name={s.icon} size={16} color={active ? '#fff' : '#888'} />}
                </View>
                {i < steps.length - 1 ? <View style={[styles.stepLine, done && { backgroundColor: Brand.primary }]} /> : null}
              </View>
            );
          })}
        </View>
        <ActivityIndicator size="large" color={Brand.primary} />
        <ThemedText style={styles.overlayText}>{label}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  hero: { borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  heroIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  heroSub: { textAlign: 'center' },
  tips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },

  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  cardTitle: { fontWeight: '700' },
  queueHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  queueIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.warning, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.two },
  queueThumb: { width: 44, height: 58, borderRadius: 8, backgroundColor: '#00000018' },
  retryBtn: {
    marginTop: Spacing.one, flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Brand.primary, borderRadius: 14, paddingVertical: 12,
  },
  retryText: { color: Brand.primary, fontWeight: '700', fontSize: 16 },

  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 14, padding: Spacing.three },

  btn: {
    flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primary, borderRadius: 16, paddingVertical: 18,
  },
  btnPressed: { backgroundColor: Brand.primaryDark },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Brand.primary, paddingVertical: 16 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  disabled: { opacity: 0.5 },

  overlay: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  overlayCard: { width: '100%', borderRadius: 16, padding: Spacing.four, alignItems: 'center', gap: Spacing.three },
  overlayText: { fontWeight: '600', textAlign: 'center' },
  steps: { flexDirection: 'row', alignItems: 'center' },
  step: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#88888844', alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 40, height: 3, backgroundColor: '#88888844' },
});
