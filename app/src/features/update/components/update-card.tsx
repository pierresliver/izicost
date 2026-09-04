// Me tab: installed version, "Check for updates", and a Download button when a newer build is published.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { t } from '@/lib/i18n';

import { fetchLatest, installedVersion, isNewer, openDownload, type Release } from '../api';
import '../i18n';

export function UpdateCard() {
  const me = installedVersion();
  const [latest, setLatest] = useState<Release | null | undefined>(undefined); // undefined = not checked yet
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    const l = await fetchLatest();
    setLatest(l); setBusy(false);
    if (l === null) Alert.alert(t('Check for updates'), t('Could not reach the update server. Try again when you are online.'));
    else if (!isNewer(l)) Alert.alert(t('You are up to date'), t('Version %v% is the latest.', { v: me.version }));
  }
  useEffect(() => {
    let live = true;
    fetchLatest().then((l) => { if (live) setLatest(l); });
    return () => { live = false; };
  }, []);

  const newer = isNewer(latest ?? null);
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={newer ? 'arrow-down-circle' : 'checkmark-circle'} size={20} color={newer ? Brand.warning : Brand.success} />
        <ThemedText type="smallBold" style={{ flex: 1 }}>{newer ? t('Update available') : t('App version')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">v{me.version}</ThemedText>
      </View>
      {newer && latest ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Version %v% is ready (%mb% MB). Download it, open the file, and Android installs it over this one. Your data stays.', { v: latest.version, mb: latest.size_mb ?? '?' })}
          </ThemedText>
          {latest.notes ? <ThemedText type="small">{latest.notes}</ThemedText> : null}
          <Pressable style={styles.primaryBtn} onPress={() => openDownload(latest).catch(() => Alert.alert(t('Error'), t('Could not open the download.')))}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <ThemedText style={styles.primaryBtnText}>{t('Download update')}</ThemedText>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.linkBtn} onPress={check} disabled={busy}>
          {busy ? <ActivityIndicator size="small" color={Brand.primary} /> : <ThemedText style={{ color: Brand.primary }}>{t('Check for updates')}</ThemedText>}
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: 12 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: Spacing.one },
});
