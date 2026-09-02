// Full-screen receipt camera: guide frame, torch, shutter, review each shot, up to 4 photos of
// one receipt (long receipts, top to bottom). Hands the photos back to the Scan tab via shots.ts.
import '@/features/scan/i18n';

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { MAX_PHOTOS } from '@/features/scan/api';
import { PhotoStrip } from '@/features/scan/components/photo-strip';
import { PhotoViewer } from '@/features/scan/components/photo-viewer';
import { setShots as handOffShots } from '@/features/scan/shots';
import { t, useLang } from '@/lib/i18n';
import { prepareImage } from '@/lib/receipts';

const CORNER = 30;

export default function CameraScreen() {
  useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [perm, requestPerm] = useCameraPermissions();
  const asked = useRef(false);
  const camRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [taking, setTaking] = useState(false);
  const [working, setWorking] = useState(false);
  const [shots, setShots] = useState<string[]>([]);
  const [review, setReview] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain && !asked.current) {
      asked.current = true;
      requestPerm().catch(() => {});
    }
  }, [perm, requestPerm]);

  const full = shots.length >= MAX_PHOTOS;

  async function snap() {
    if (!camRef.current || !ready || taking || full) return;
    setTaking(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const pic = await camRef.current.takePictureAsync({ quality: 0.9 });
      setReview(pic.uri);
    } catch (e) {
      Alert.alert(t('Could not take the photo'), String((e as Error).message ?? e));
    } finally {
      setTaking(false);
    }
  }

  async function acceptReview() {
    if (!review || working) return;
    setWorking(true);
    try {
      const small = await prepareImage(review);
      setShots((s) => [...s, small].slice(0, MAX_PHOTOS));
      setReview(null);
    } catch (e) {
      Alert.alert(t('Could not take the photo'), String((e as Error).message ?? e));
    } finally {
      setWorking(false);
    }
  }

  async function pickFromGallery(finishAfter = false) {
    const left = MAX_PHOTOS - shots.length;
    if (left <= 0) { Alert.alert(t('Maximum of 4 photos per receipt.')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: left, orderedSelection: true,
    });
    if (res.canceled || !res.assets?.length) return;
    setWorking(true);
    try {
      const prepared: string[] = [];
      for (const a of res.assets.slice(0, left)) prepared.push(await prepareImage(a.uri));
      const next = [...shots, ...prepared].slice(0, MAX_PHOTOS);
      setShots(next);
      if (finishAfter) finish(next);
    } catch (e) {
      Alert.alert(t('Could not take the photo'), String((e as Error).message ?? e));
    } finally {
      setWorking(false);
    }
  }

  function finish(list = shots) {
    if (!list.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    handOffShots(list);
    router.back();
  }

  function close() {
    if (!shots.length) { router.back(); return; }
    Alert.alert(t('Discard these photos?'), undefined, [
      { text: t('Keep'), style: 'cancel' },
      { text: t('Discard'), style: 'destructive', onPress: () => router.back() },
    ]);
  }

  // Guide frame: a tall receipt-shaped window, centred, leaving room for the bars.
  const frameW = Math.round(width * 0.76);
  const frameH = Math.min(Math.round(frameW * 1.5), Math.round(height * 0.55));
  const topBand = insets.top + 92;

  const screenOptions = <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />;

  if (!perm) {
    return (
      <ThemedView style={styles.center}>
        {screenOptions}
        <ActivityIndicator color={Brand.primary} />
      </ThemedView>
    );
  }

  if (!perm.granted) {
    return (
      <ThemedView style={[styles.center, { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four }]}>
        {screenOptions}
        <View style={styles.permIcon}><Ionicons name="camera-outline" size={40} color="#fff" /></View>
        <ThemedText style={styles.permTitle}>{t('Camera')}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.permText}>{t('Camera permission is needed to scan receipts.')}</ThemedText>
        <View style={{ gap: Spacing.two, width: '100%' }}>
          {perm.canAskAgain ? (
            <Pressable style={styles.primaryBtn} onPress={() => requestPerm()}>
              <Ionicons name="camera" color="#fff" size={22} />
              <Text style={styles.primaryBtnText}>{t('Allow camera')}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryBtn} onPress={() => Linking.openSettings()}>
              <Ionicons name="settings-outline" color="#fff" size={22} />
              <Text style={styles.primaryBtnText}>{t('Open settings')}</Text>
            </Pressable>
          )}
          <Pressable style={styles.secondaryBtn} onPress={() => pickFromGallery(true)} disabled={working}>
            {working ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="images" color={Brand.primary} size={22} />}
            <Text style={styles.secondaryBtnText}>{t('Choose from gallery')}</Text>
          </Pressable>
          <Pressable style={styles.textBtn} onPress={() => router.back()}>
            <ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <View style={styles.root}>
      {screenOptions}
      <StatusBar style="light" />
      <CameraView
        ref={camRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        animateShutter={false}
        mute
        onCameraReady={() => setReady(true)}
      />

      {/* Darkened surround + receipt-shaped window */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.dim, { height: topBand }]} />
        <View style={{ flexDirection: 'row', height: frameH }}>
          <View style={[styles.dim, { flex: 1 }]} />
          <View style={{ width: frameW }}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={[styles.dim, { flex: 1 }]} />
        </View>
        <View style={[styles.dim, { flex: 1 }]}>
          <View style={styles.hints}>
            <Text style={styles.hintTitle}>{t('Fit the receipt inside the frame')}</Text>
            <Text style={styles.hintSub}>{t('Lay it flat · good light · no glare · include the total')}</Text>
          </View>
        </View>
      </View>

      {!ready ? (
        <View style={[StyleSheet.absoluteFill, styles.starting]} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.startingText}>{t('Starting the camera…')}</Text>
        </View>
      ) : null}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable onPress={close} style={styles.roundBtn} hitSlop={8} accessibilityLabel={t('Cancel')}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <View style={styles.counter}>
          <Text style={styles.counterText}>{t('Photo %n% of %max%', { n: Math.min(shots.length + 1, MAX_PHOTOS), max: MAX_PHOTOS })}</Text>
        </View>
        <Pressable onPress={() => setTorch((v) => !v)} style={[styles.roundBtn, torch && styles.roundBtnOn]} hitSlop={8} accessibilityLabel={t('Torch')}>
          <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color={torch ? '#111' : '#fff'} />
        </Pressable>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.three }]}>
        {shots.length ? (
          <View style={styles.stripWrap}>
            <PhotoStrip uris={shots} height={72} onPress={setViewer} onRemove={(i) => setShots((s) => s.filter((_, j) => j !== i))} />
            <Text style={styles.stripHint}>{full ? t('Maximum of 4 photos per receipt.') : t('Long receipt? Add the next part below.')}</Text>
          </View>
        ) : null}
        <View style={styles.controls}>
          <Pressable onPress={() => pickFromGallery()} style={styles.sideBtn} disabled={working || full} accessibilityLabel={t('Gallery')}>
            <Ionicons name="images" size={24} color="#fff" />
            <Text style={styles.sideLabel}>{t('Gallery')}</Text>
          </Pressable>

          <View style={styles.shutterWrap}>
            <Pressable onPress={snap} disabled={!ready || taking || full || working} style={({ pressed }) => [styles.shutter, (pressed || taking) && styles.shutterPressed, full && { opacity: 0.35 }]}>
              <View style={styles.shutterInner}>{taking ? <ActivityIndicator color={Brand.primary} /> : null}</View>
            </Pressable>
            <Text style={styles.shutterLabel}>{shots.length && !full ? t('Add another photo') : ' '}</Text>
          </View>

          {shots.length ? (
            <Pressable onPress={() => finish()} style={styles.doneBtn} disabled={working}>
              {working ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={22} color="#fff" />}
              <Text style={styles.doneText}>{t('Done')}</Text>
            </Pressable>
          ) : <View style={styles.sideBtn} />}
        </View>
      </View>

      {/* Review the shot: the person judges sharpness, we never fake a blur score. */}
      {review ? (
        <View style={[StyleSheet.absoluteFill, styles.review]}>
          <Image source={{ uri: review }} style={{ flex: 1 }} resizeMode="contain" />
          <View style={[styles.reviewTop, { top: insets.top + Spacing.three }]} pointerEvents="none">
            <View style={styles.counter}><Text style={styles.counterText}>{t('Is the text sharp and readable?')}</Text></View>
          </View>
          <View style={[styles.reviewBar, { paddingBottom: insets.bottom + Spacing.three }]}>
            <Pressable style={[styles.reviewBtn, styles.reviewRetake]} onPress={() => setReview(null)} disabled={working}>
              <Ionicons name="refresh" size={22} color="#fff" />
              <Text style={styles.reviewBtnText}>{t('Retake')}</Text>
            </Pressable>
            <Pressable style={[styles.reviewBtn, styles.reviewUse]} onPress={acceptReview} disabled={working}>
              {working ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={22} color="#fff" />}
              <Text style={styles.reviewBtnText}>{t('Use this photo')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <PhotoViewer uris={shots} index={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  permIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  permTitle: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  permText: { textAlign: 'center', marginBottom: Spacing.three },
  primaryBtn: {
    flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primary, borderRadius: 16, paddingVertical: 16,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Brand.primary, borderRadius: 16, paddingVertical: 14,
  },
  secondaryBtnText: { color: Brand.primary, fontSize: 17, fontWeight: '700' },
  textBtn: { alignItems: 'center', paddingVertical: Spacing.two },

  dim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#fff' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  hints: { alignItems: 'center', paddingTop: Spacing.three, paddingHorizontal: Spacing.four, gap: 4 },
  hintTitle: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  hintSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center' },
  starting: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  startingText: { color: '#fff', fontWeight: '600' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.three,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  roundBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  roundBtnOn: { backgroundColor: '#FFD54F' },
  counter: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  counterText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: Spacing.two },
  stripWrap: { paddingHorizontal: Spacing.three, gap: 6 },
  stripHint: { color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four },
  sideBtn: { width: 76, alignItems: 'center', gap: 4 },
  sideLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  shutterWrap: { alignItems: 'center', gap: 6 },
  shutter: {
    width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)',
  },
  shutterPressed: { transform: [{ scale: 0.92 }] },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterLabel: { color: '#fff', fontSize: 12, fontWeight: '600', minHeight: 16 },
  doneBtn: {
    minWidth: 76, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.success, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12,
  },
  doneText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  review: { backgroundColor: '#000' },
  reviewTop: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  reviewBar: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, backgroundColor: '#000' },
  reviewBtn: { flex: 1, flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 16 },
  reviewRetake: { borderWidth: 2, borderColor: '#fff' },
  reviewUse: { backgroundColor: Brand.success },
  reviewBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
