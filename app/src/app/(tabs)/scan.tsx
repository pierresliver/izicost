import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { t, useLang } from '@/lib/i18n';
import { setPending } from '@/lib/pending';
import { extractReceipt, prepareImage, uploadImage } from '@/lib/receipts';

type Phase = 'idle' | 'uploading' | 'reading';

export default function ScanScreen() {
  useLang();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(fromCamera: boolean) {
    setError(null);
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setError(t('Camera permission is needed to scan receipts.')); return; }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]?.uri) return;
    await run(res.assets[0].uri);
  }

  async function run(uri: string) {
    try {
      setPhase('uploading');
      const small = await prepareImage(uri);
      setPreview(small);
      const imagePath = await uploadImage(small);
      setPhase('reading');
      const { extraction, model } = await extractReceipt(imagePath);
      setPending({ extraction, raw: JSON.parse(JSON.stringify(extraction)), imagePath, localUri: small, model });
      setPhase('idle');
      router.push('/confirm');
    } catch (e) {
      setPhase('idle');
      const msg = String((e as Error).message ?? e);
      setError(msg);
      Alert.alert(t('Could not read this receipt'), msg);
    }
  }

  const busy = phase !== 'idle';

  return (
    <ThemedView style={styles.container}>
      <View style={styles.previewBox}>
        {preview ? <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" /> : (
          <Ionicons name="receipt-outline" size={96} color={Brand.primary} />
        )}
        {busy ? (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <ThemedText style={styles.overlayText}>
              {phase === 'uploading' ? t('Uploading photo…') : t('Reading the receipt… about 10 seconds')}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText themeColor="textSecondary" style={styles.hint}>
        {t('Lay the receipt flat, good light, no glare. Include the total.')}
      </ThemedText>
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable style={[styles.btn, busy && styles.btnDisabled]} disabled={busy} onPress={() => pick(true)}>
        <Ionicons name="camera" color="#fff" size={22} />
        <ThemedText style={styles.btnText}>{t('Take a photo')}</ThemedText>
      </Pressable>
      <Pressable style={[styles.btn, styles.btnSecondary, busy && styles.btnDisabled]} disabled={busy} onPress={() => pick(false)}>
        <Ionicons name="images" color={Brand.primary} size={22} />
        <ThemedText style={[styles.btnText, { color: Brand.primary }]}>{t('Choose from gallery')}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  previewBox: {
    flex: 1, borderRadius: 16, backgroundColor: '#00000010', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  preview: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000aa', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  overlayText: { color: '#fff', fontWeight: '600' },
  hint: { textAlign: 'center' },
  error: { color: Brand.danger, textAlign: 'center' },
  btn: {
    flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primary, borderRadius: 14, paddingVertical: 14,
  },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Brand.primary },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
