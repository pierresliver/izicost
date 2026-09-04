// Shelf scan, step 2: the walk. A photo every N seconds, no sound, no flash, screen almost black.
// Tap the screen to pause and see the controls; Done goes to the photo check.
import '@/features/shelf/i18n';

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { disposeShots, getSession, updateSession, type Shot } from '@/features/shelf/session';
import { detailScore, flagBlurry } from '@/features/shelf/sharpness';
import { t, useLang } from '@/lib/i18n';
import { prepareImage } from '@/lib/receipts';

const MAX_SHOTS = 120; // 10 reads of 12 photos
const COUNTDOWN = 5;

type Mode = 'countdown' | 'running' | 'paused';

export default function ShelfCaptureScreen() {
  useLang();
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = getSession();
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>('countdown');
  const [count, setCount] = useState(COUNTDOWN);
  const [shots, setShots] = useState<Shot[]>(session?.shots ?? []); // "Take more photos" continues the walk
  const [pendingCount, setPendingCount] = useState(0); // photos being taken or measured
  const shotsRef = useRef<Shot[]>(session?.shots ?? []);
  const pendingRef = useRef(0);
  const takingRef = useRef(false);
  const asked = useRef(false);

  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain && !asked.current) {
      asked.current = true;
      requestPerm().catch(() => {});
    }
  }, [perm, requestPerm]);

  // A phone call or the power button pauses the walk instead of silently dropping frames.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st !== 'active') setMode((m) => (m === 'running' ? 'paused' : m)); });
    return () => sub.remove();
  }, []);

  // Countdown: time to put the phone in the pocket.
  useEffect(() => {
    if (mode !== 'countdown' || !ready) return;
    const h = setTimeout(() => {
      if (count <= 1) setMode('running');
      else setCount((c) => c - 1);
    }, 1000);
    return () => clearTimeout(h);
  }, [mode, count, ready]);

  // The interval timer. Each tick takes one picture; measuring sharpness happens off the timer.
  useEffect(() => {
    if (mode !== 'running' || !session) return;
    const bumpPending = (d: number) => { pendingRef.current = Math.max(0, pendingRef.current + d); setPendingCount(pendingRef.current); };
    const tick = async () => {
      if (takingRef.current || !camRef.current || shotsRef.current.length + pendingRef.current >= MAX_SHOTS) return;
      takingRef.current = true;
      bumpPending(1); // counted from the moment the shutter fires, so Done waits for it
      let pic: { uri: string } | null = null;
      try {
        // shutterSound: false keeps Android silent (iPhones always click, by Apple's rule)
        pic = await camRef.current.takePictureAsync({ quality: 0.85, shutterSound: false });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {
        /* a missed frame is fine; the next tick tries again */
      } finally {
        takingRef.current = false;
      }
      if (!pic) { bumpPending(-1); return; }
      const original = pic.uri;
      (async () => {
        try {
          const small = await prepareImage(original);
          FileSystem.deleteAsync(original, { idempotent: true }).catch(() => {}); // only the 1200-px copy is kept
          const score = await detailScore(small);
          const shot: Shot = { uri: small, score, blurry: false, keep: true, takenAt: Date.now() };
          shotsRef.current = [...shotsRef.current, shot];
          setShots(shotsRef.current);
          if (shotsRef.current.length >= MAX_SHOTS) setMode((m) => (m === 'running' ? 'paused' : m));
        } catch {
          /* unreadable frame: skipped */
        } finally {
          bumpPending(-1);
        }
      })();
    };
    tick();
    const h = setInterval(tick, session.intervalSec * 1000);
    return () => clearInterval(h);
  }, [mode, session]);

  function finish() {
    const scores = shotsRef.current.map((s) => s.score);
    const blurry = flagBlurry(scores);
    const decided = new Map((session?.shots ?? []).map((s) => [s.uri, s.keep])); // choices already made on the photo screen stay
    const marked = shotsRef.current.map((s, i) => ({ ...s, blurry: blurry[i], keep: decided.get(s.uri) ?? !blurry[i] }));
    updateSession({ shots: marked });
    router.replace('/shelf/photos');
  }

  function cancel() {
    Alert.alert(t('Stop and discard these photos?'), undefined, [
      { text: t('Keep going'), style: 'cancel' },
      { text: t('Discard'), style: 'destructive', onPress: () => { disposeShots(shotsRef.current.map((s) => s.uri)); updateSession({ shots: [] }); router.back(); } },
    ]);
  }

  const screenOptions = <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />;

  if (!session) {
    return (
      <View style={[styles.root, styles.center, { gap: Spacing.three }]}>
        {screenOptions}
        <Text style={styles.dimText}>{t('Nothing to save')}</Text>
        <Pressable onPress={() => router.back()}><Text style={styles.bigText}>{t('Cancel')}</Text></Pressable>
      </View>
    );
  }
  if (!perm) return <View style={styles.root}>{screenOptions}<ActivityIndicator color="#fff" /></View>;
  if (!perm.granted) {
    return (
      <View style={[styles.root, styles.center, { padding: Spacing.four, gap: Spacing.three }]}>
        {screenOptions}
        <Ionicons name="camera-outline" size={40} color="#fff" />
        <Text style={styles.bigText}>{t('Camera permission is needed to scan shelves.')}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())}>
          <Text style={styles.primaryBtnText}>{perm.canAskAgain ? t('Allow camera') : t('Open settings')}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}><Text style={styles.dimText}>{t('Cancel')}</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {screenOptions}
      <StatusBar style="light" hidden />
      <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={false} animateShutter={false} mute onCameraReady={() => setReady(true)} />

      {mode === 'countdown' ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.veil]}>
          <Text style={styles.countdown}>{ready ? count : ''}</Text>
          <Text style={styles.bigText}>{ready ? t('Put the phone in your pocket, camera facing the shelves.') : t('Starting the camera…')}</Text>
          <Text style={styles.dimText}>{t('%store% · a photo every %n% s', { store: session.store.name, n: session.intervalSec })}</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: Spacing.four }}><Text style={styles.dimText}>{t('Cancel')}</Text></Pressable>
        </View>
      ) : null}

      {mode === 'running' ? (
        // Almost black on purpose: nothing to see through a shirt pocket, and no glow. One tap pauses.
        <Pressable onPress={() => setMode('paused')} style={[StyleSheet.absoluteFill, styles.dark]} accessibilityRole="button" accessibilityLabel={t('Tap to pause')}>
          <View style={[styles.stealthRow, { top: insets.top + Spacing.three }]}>
            <View style={styles.recDot} />
            <Text style={styles.stealthText}>{shots.length + pendingCount}</Text>
          </View>
          <Text style={[styles.stealthHint, { bottom: insets.bottom + Spacing.four }]}>{t('Tap to pause')}</Text>
        </Pressable>
      ) : null}

      {mode === 'paused' ? (
        <View style={[StyleSheet.absoluteFill, styles.veil, { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four, padding: Spacing.four, justifyContent: 'space-between' }]}>
          <View style={{ alignItems: 'center', gap: Spacing.two }}>
            <Text style={styles.countdown}>{shots.length}</Text>
            <Text style={styles.bigText}>{shots.length === 1 ? t('%n% photo taken', { n: 1 }) : t('%n% photos taken', { n: shots.length })}</Text>
            {pendingCount ? <Text style={styles.dimText}>{t('Measuring sharpness…')}</Text> : null}
            {shots.length >= MAX_SHOTS ? <Text style={styles.dimText}>{t('Maximum reached for one walk.')}</Text> : null}
          </View>
          <View style={{ gap: Spacing.two }}>
            <Pressable style={[styles.primaryBtn, { backgroundColor: Brand.success }, (!shots.length || pendingCount > 0) && { opacity: 0.5 }]} disabled={!shots.length || pendingCount > 0} onPress={finish}>
              <Ionicons name="checkmark" size={22} color="#fff" />
              <Text style={styles.primaryBtnText}>{t('Done, check the photos')}</Text>
            </Pressable>
            {shots.length < MAX_SHOTS ? (
              <Pressable style={styles.secondaryBtn} onPress={() => { setCount(3); setMode('countdown'); }}>
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>{t('Keep going')}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={cancel} style={{ alignItems: 'center', paddingVertical: Spacing.two }}><Text style={styles.dimText}>{t('Discard')}</Text></Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  veil: { backgroundColor: 'rgba(0,0,0,0.82)', gap: Spacing.two, padding: Spacing.four },
  dark: { backgroundColor: 'rgba(0,0,0,0.97)' },
  countdown: { color: '#fff', fontSize: 72, fontWeight: '900', lineHeight: 80 },
  bigText: { color: '#fff', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  dimText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
  stealthRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C62828', opacity: 0.6 },
  stealthText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: '700' },
  stealthHint: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12 },
  primaryBtn: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.primary, borderRadius: 16, paddingVertical: 16, paddingHorizontal: Spacing.four },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', borderRadius: 16, paddingVertical: 14 },
});
