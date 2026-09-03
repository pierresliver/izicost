// First-launch introduction: four swipeable cards. Same idea as IziCamera's onboarding, own code.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { t, useLang } from '@/lib/i18n';

export const ONBOARDING_KEY = 'izicost.onboardingSeen';

type Card = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; color: string };

const CARDS: Card[] = [
  { icon: 'mic', color: Brand.primary, title: 'Say what you need', body: 'Speak or type your shopping list. IziCost turns it into a basket in seconds.' },
  { icon: 'storefront', color: Brand.success, title: 'See where it is cheapest', body: 'We compare real prices from receipts across the stores near you or in any city, and show which shop sells the whole basket cheapest.' },
  { icon: 'camera', color: '#2F6DB5', title: 'Scan receipts to keep prices fresh', body: 'One photo reads every item and price in about ten seconds. Your spending reports stay private; only prices are shared, anonymously.' },
  { icon: 'people', color: '#B5542F', title: 'Better together', body: 'Every receipt anyone scans makes the prices fresher for everyone. Invite your friends and family, and only prices are ever shared, never who you are or what you spent.' },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  useLang();
  const width = Dimensions.get('window').width;
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Card>>(null);

  function finish() {
    AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});
    onDone();
  }
  function next() {
    if (index >= CARDS.length - 1) return finish();
    list.current?.scrollToIndex({ index: index + 1, animated: true });
  }
  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  const last = index === CARDS.length - 1;
  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.top}>
          <ThemedText type="subtitle" style={{ color: Brand.primary }}>IziCost</ThemedText>
          {!last ? (
            <Pressable onPress={finish} hitSlop={10}><ThemedText themeColor="textSecondary">{t('Skip')}</ThemedText></Pressable>
          ) : <View />}
        </View>
        <FlatList
          ref={list}
          data={CARDS}
          keyExtractor={(c) => c.title}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item }) => (
            <View style={[styles.card, { width }]}>
              <View style={[styles.iconCircle, { backgroundColor: item.color + '22' }]}>
                <Ionicons name={item.icon} size={84} color={item.color} />
              </View>
              <ThemedText type="title" style={styles.title}>{t(item.title)}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.body}>{t(item.body)}</ThemedText>
            </View>
          )}
        />
        <View style={styles.dots}>
          {CARDS.map((_, i) => <View key={i} style={[styles.dot, i === index && styles.dotActive]} />)}
        </View>
        <Pressable style={styles.btn} onPress={next}>
          <ThemedText style={styles.btnText}>{last ? t('Get started') : t('Next')}</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

export async function hasSeenOnboarding(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1'; } catch { return true; }
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.five, gap: Spacing.four },
  iconCircle: { width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', fontSize: 17, lineHeight: 25 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: Spacing.three },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8884' },
  dotActive: { backgroundColor: Brand.primary, width: 22 },
  btn: { marginHorizontal: Spacing.four, marginBottom: Spacing.four, backgroundColor: Brand.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
