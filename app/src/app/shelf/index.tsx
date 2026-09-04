// Shelf scan, step 1: which shop, how often to take a photo, then start the walk.
import '@/features/shelf/i18n';

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { getStore, nearbyStores, type NearbyStore, type StoreInfo } from '@/features/prices/api';
import { captureLocation } from '@/features/prices/location';
import { Chip } from '@/features/reports/ui';
import { createStore, pinStore, searchStores, shelfScanAllowed } from '@/features/shelf/api';
import { currencyFor, INTERVALS, loadInterval, saveInterval, startSession } from '@/features/shelf/session';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';

export default function ShelfSetupScreen() {
  useLang();
  const theme = useTheme();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [near, setNear] = useState<NearbyStore[]>([]);
  const [locating, setLocating] = useState(true);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<StoreInfo[]>([]);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [interval, setInterval_] = useState(5);
  const [creating, setCreating] = useState(false);
  const [newCity, setNewCity] = useState('');
  const [newCountry, setNewCountry] = useState<'MZ' | 'ZA'>('MZ');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    shelfScanAllowed().then(setAllowed);
    loadInterval().then(setInterval_);
    (async () => {
      const p = await captureLocation();
      setPos(p);
      if (p) {
        try { setNear(await nearbyStores(p.lat, p.lng, 1)); } catch { /* list stays empty */ }
      }
      setLocating(false);
    })();
  }, []);

  useEffect(() => {
    const short = query.trim().length < 2;
    const h = setTimeout(() => {
      if (short) { setFound([]); return; }
      searchStores(query).then(setFound).catch(() => setFound([]));
    }, short ? 0 : 250);
    return () => clearTimeout(h);
  }, [query]);

  async function pickNearby(n: NearbyStore) {
    // the nearby list has no country; fetch the full row so the currency (MZN / ZAR) is right
    const full = await getStore(n.id).catch(() => null);
    setStore(full ?? { id: n.id, name: n.name, branch_address: n.branch_address, city: n.city, country: null, store_type: n.store_type, lat: null, lng: null });
    setCreating(false);
  }

  async function createNew() {
    if (query.trim().length < 2) { Alert.alert(t('Type the shop name first.')); return; }
    if (newCity.trim().length < 2) { Alert.alert(t('Which city is this shop in?')); return; }
    setBusy(true);
    try {
      const s = await createStore(query, newCity, newCountry);
      if (pos && s.lat === null) pinStore(s.id, pos);
      setStore({ ...s, country: s.country ?? newCountry });
      setCreating(false);
    } catch (e) {
      Alert.alert(t('Could not create the shop'), String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (!store) return;
    saveInterval(interval);
    startSession(store, currencyFor(store), interval);
    router.push('/shelf/capture');
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t('Shelf scan') }} />
      {allowed === false ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">{t('Testers only for now')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('Shelf scan is being tried out by a small group before it opens to everyone. Prices from receipts are always welcome.')}</ThemedText>
        </ThemedView>
      ) : null}

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">{t('How it works')}</ThemedText>
        <Step n={1} text={t('Choose the shop you are in.')} />
        <Step n={2} text={t('Put the phone in a shirt pocket with the camera looking out, then walk slowly along the shelves. It takes a photo every few seconds, silently, with the screen dark.')} />
        <Step n={3} text={t('Tap the screen when you are done. Blurry photos are flagged; the rest are read and you check every price before it is shared.')} />
        <ThemedText type="small" themeColor="textSecondary">{t('Some shops do not allow photos. Please respect the rules of the shop you are in. Android phones stay silent; iPhones always play the shutter sound.')}</ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">{t('Which shop?')}</ThemedText>
        {store ? (
          <View style={[styles.chosen, { backgroundColor: `${Brand.success}1A` }]}>
            <Ionicons name="storefront" size={22} color={Brand.success} />
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">{store.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{[store.branch_address, store.city].filter(Boolean).join(' · ') || t('No address yet')}</ThemedText>
            </View>
            <Pressable onPress={() => setStore(null)} hitSlop={8} accessibilityLabel={t('Remove')}><Ionicons name="close-circle" size={22} color={theme.textSecondary} /></Pressable>
          </View>
        ) : (
          <>
            {locating ? (
              <View style={styles.rowCenter}><ActivityIndicator color={Brand.primary} /><ThemedText type="small" themeColor="textSecondary">{t('Looking for shops around you…')}</ThemedText></View>
            ) : near.length ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">{t('Near you')}</ThemedText>
                {near.slice(0, 5).map((n) => (
                  <Pressable key={n.id} onPress={() => pickNearby(n)} style={({ pressed }) => [styles.storeRow, { borderTopColor: theme.backgroundSelected }, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="location-outline" size={18} color={Brand.primary} />
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold">{n.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{[n.branch_address, n.city].filter(Boolean).join(' · ')}</ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">{n.distance_km < 1 ? `${Math.round(n.distance_km * 1000)} m` : `${n.distance_km.toFixed(1)} km`}</ThemedText>
                  </Pressable>
                ))}
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">{pos ? t('No known shop within 1 km. Search for it or add it below.') : t('Location is off. Search for the shop by name.')}</ThemedText>
            )}
            <TextInput style={inputStyle} value={query} onChangeText={(v) => { setQuery(v); setCreating(false); }} placeholder={t('Search a shop by name')} placeholderTextColor="#888" />
            {found.map((s) => (
              <Pressable key={s.id} onPress={() => setStore(s)} style={({ pressed }) => [styles.storeRow, { borderTopColor: theme.backgroundSelected }, pressed && { opacity: 0.7 }]}>
                <Ionicons name="storefront-outline" size={18} color={Brand.primary} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">{s.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{[s.branch_address, s.city].filter(Boolean).join(' · ')}</ThemedText>
                </View>
              </Pressable>
            ))}
            {query.trim().length >= 2 && !creating && found.length === 0 ? (
              <Pressable onPress={() => setCreating(true)} style={styles.linkRow}>
                <Ionicons name="add-circle-outline" size={18} color={Brand.primary} />
                <ThemedText style={{ color: Brand.primary, fontWeight: '600' }}>{t('Add "%name%" as a new shop', { name: query.trim() })}</ThemedText>
              </Pressable>
            ) : null}
            {creating ? (
              <View style={{ gap: Spacing.two }}>
                <TextInput style={inputStyle} value={newCity} onChangeText={setNewCity} placeholder={t('City')} placeholderTextColor="#888" />
                <View style={styles.chips}>
                  <Chip label={t('Mozambique')} active={newCountry === 'MZ'} onPress={() => setNewCountry('MZ')} />
                  <Chip label={t('South Africa')} active={newCountry === 'ZA'} onPress={() => setNewCountry('ZA')} />
                </View>
                <Pressable style={[styles.secondaryBtn, busy && { opacity: 0.5 }]} disabled={busy} onPress={createNew}>
                  {busy ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="add" size={20} color={Brand.primary} />}
                  <ThemedText style={{ color: Brand.primary, fontWeight: '700' }}>{t('Create shop')}</ThemedText>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">{t('A photo every…')}</ThemedText>
        <View style={styles.chips}>
          {INTERVALS.map((s) => <Chip key={s} label={t('%n% s', { n: s })} active={interval === s} onPress={() => setInterval_(s)} />)}
        </View>
        <ThemedText type="small" themeColor="textSecondary">{t('Walk one shelf section per photo. Slower walking or a shorter interval catches more labels.')}</ThemedText>
      </ThemedView>

      <Pressable style={({ pressed }) => [styles.primaryBtn, (!store || allowed !== true) && { opacity: 0.45 }, pressed && { opacity: 0.8 }]} disabled={!store || allowed !== true} onPress={start}>
        <Ionicons name="camera" color="#fff" size={22} />
        <ThemedText style={styles.primaryBtnText}>{t('Start the walk')}</ThemedText>
      </Pressable>
      <View style={styles.rowCenter}>
        <Ionicons name="lock-closed-outline" size={12} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">{t('Photos are read and deleted; only product, shop and price are kept.')}</ThemedText>
      </View>
    </ScrollView>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' }}>
      <View style={styles.stepDot}><ThemedText style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{n}</ThemedText></View>
      <ThemedText type="small" style={{ flex: 1 }}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, padding: Spacing.two },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  primaryBtn: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.primary, borderRadius: 16, paddingVertical: 18 },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Brand.primary, borderRadius: 14, paddingVertical: 12 },
});
