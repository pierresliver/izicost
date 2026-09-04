// "This week's story": full-screen swipeable slides — your week, biggest receipt, best find, category
// movers, household leaderboard — each one shareable as a card. Opened from the Sunday notification or Home.
import '@/features/household/i18n';
import '@/features/reports/i18n';
import '@/features/share/i18n';
import '@/features/watch/i18n';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { memberName, useHousehold } from '@/features/household/api';
import { fetchReceipts, loadDashboard, type Dashboard, type ReceiptLite } from '@/features/reports/api';
import { addDays, iso } from '@/features/reports/dates';
import { categoryInflation, fetchHistory, type CategoryInflation } from '@/features/reports/insights';
import { BigNumber, Rows, ShareCard, ShareCardModal } from '@/features/share/share-card';
import { movement, watchlist, type WatchRow } from '@/features/watch/api';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

type Slide = { key: string; color: string; icon: keyof typeof Ionicons.glyphMap; kicker: string; big: string; text: string; rows?: { left: string; right: string; sub?: string }[]; tone?: 'up' | 'down' | 'neutral' };

const pctText = (pct: number) => `${pct > 0 ? '+' : ''}${Math.round(pct)}%`;

export default function RecapScreen() {
  useLang();
  const router = useRouter();
  const { household } = useHousehold();
  const width = Dimensions.get('window').width;
  const list = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [share, setShare] = useState<Slide | null>(null);
  const [d, setD] = useState<Dashboard | null>(null);
  const [week, setWeek] = useState<ReceiptLite[]>([]);
  const [drops, setDrops] = useState<WatchRow[]>([]);
  const [cats, setCats] = useState<CategoryInflation[]>([]);
  const [family, setFamily] = useState<ReceiptLite[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const today = new Date(); const from = iso(addDays(today, -6));
    (async () => {
      try {
        const [dash, mine, watch, hist, fam] = await Promise.all([
          loadDashboard({ onlyMe: true }),
          fetchReceipts(from, iso(addDays(today, 1)), { onlyMe: true }),
          watchlist().catch(() => [] as WatchRow[]),
          fetchHistory().catch(() => []),
          household ? fetchReceipts(from, iso(addDays(today, 1)), { allHousehold: true }).catch(() => [] as ReceiptLite[]) : Promise.resolve([] as ReceiptLite[]),
        ]);
        setD(dash); setWeek(mine); setDrops(watch.filter((r) => movement(r).tone === 'down')); setCats(categoryInflation(hist)); setFamily(fam);
      } finally { setReady(true); }
    })();
  }, [household]);

  const slides: Slide[] = (() => {
    if (!d) return [];
    const cur = d.currency;
    const out: Slide[] = [];
    const pct = d.week.previous > 0 ? ((d.week.current - d.week.previous) / d.week.previous) * 100 : null;
    if (d.week.currentCount > 0) out.push({
      key: 'week', color: Brand.primary, icon: 'calendar', kicker: t('Your week'), big: formatMoney(d.week.current, cur),
      text: pct === null ? t('%n% receipts this week', { n: d.week.currentCount }) : t('%pct% vs the week before · %n% receipts', { pct: pctText(pct), n: d.week.currentCount }),
      tone: pct === null ? 'neutral' : pct > 0 ? 'up' : 'down',
    });
    const biggest = [...week].sort((a, b) => (b.total ?? 0) - (a.total ?? 0))[0];
    if (biggest) out.push({
      key: 'biggest', color: '#2F6DB5', icon: 'cart', kicker: t('Biggest shop of the week'), big: formatMoney(biggest.total, cur),
      text: `${biggest.store_name ?? '?'} · ${biggest.purchased_on ?? ''}`,
      rows: [...week].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).slice(0, 4).map((r) => ({ left: r.store_name ?? '?', sub: r.purchased_on ?? undefined, right: formatMoney(r.total, cur) })),
    });
    const best = [...drops].sort((a, b) => (movement(a).pct ?? 0) - (movement(b).pct ?? 0))[0];
    if (best && best.best_price !== null) {
      const m = movement(best);
      out.push({
        key: 'find', color: '#1E9E5A', icon: 'pricetag', kicker: t('Best find'), big: formatMoney(best.best_price, best.currency),
        text: `${best.display_name} · ${[best.best_store, best.best_city].filter(Boolean).join(' · ')} · ${m.pct !== null ? pctText(m.pct) : ''}`, tone: 'down',
        rows: drops.slice(0, 4).map((r) => ({ left: r.display_name, sub: [r.best_store, r.best_city].filter(Boolean).join(' · '), right: `${formatMoney(r.best_price, r.currency)} (${pctText(movement(r).pct ?? 0)})` })),
      });
    }
    const movers = cats.filter((c) => Math.abs(c.changePct) >= 1).slice(0, 5);
    if (movers.length) out.push({
      key: 'cats', color: '#B5542F', icon: 'trending-up', kicker: t('Price movers in your basket'), big: `${t(movers[0].category)} ${pctText(movers[0].changePct)}`,
      text: t('latest price vs 1–3 months ago'), tone: movers[0].changePct > 0 ? 'up' : 'down',
      rows: movers.map((c) => ({ left: t(c.category), sub: c.items === 1 ? t('1 item') : t('%n% items', { n: c.items }), right: pctText(c.changePct) })),
    });
    if (household && family.length) {
      const m = new Map<string, { total: number; count: number }>();
      for (const r of family) { if ((r.currency ?? '?') !== cur) continue; const x = m.get(r.user_id) ?? { total: 0, count: 0 }; x.total += r.total ?? 0; x.count++; m.set(r.user_id, x); }
      const board = [...m.entries()].sort((a, b) => b[1].total - a[1].total);
      if (board.length > 1) out.push({
        key: 'family', color: '#6D28D9', icon: 'people', kicker: t('Household leaderboard'), big: memberName(board[0][0]) ?? '?',
        text: t('spent the most this week: %amount%', { amount: formatMoney(board[0][1].total, cur) }),
        rows: board.map(([uid, x], i) => ({ left: `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•'} ${memberName(uid) ?? '?'}`, sub: `${x.count} ${t('receipts')}`, right: formatMoney(x.total, cur) })),
      });
    }
    return out;
  })();

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  const next = () => { if (index >= slides.length - 1) router.back(); else { list.current?.scrollToIndex({ index: index + 1, animated: true }); setIndex(index + 1); } };
  const bg = slides[index]?.color ?? Brand.primary;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.top}>
          <Text style={styles.brand}>IziCost · {t('This week’s story')}</Text>
          <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="close" size={26} color="#fff" /></Pressable>
        </View>
        {!ready ? <View style={styles.center}><ActivityIndicator color="#fff" size="large" /></View> : !slides.length ? (
          <View style={styles.center}><Ionicons name="receipt-outline" size={48} color="#fff" /><Text style={styles.big}>{t('No story yet')}</Text><Text style={styles.text}>{t('Scan a receipt this week and come back on Sunday.')}</Text></View>
        ) : (
          <FlatList
            ref={list} data={slides} keyExtractor={(s) => s.key} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll} getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            renderItem={({ item }) => (
              <View style={[styles.slide, { width }]}>
                <View style={styles.iconCircle}><Ionicons name={item.icon} size={56} color="#fff" /></View>
                <Text style={styles.kicker}>{item.kicker}</Text>
                <Text style={styles.big}>{item.big}</Text>
                <Text style={styles.text}>{item.text}</Text>
                {item.rows ? (
                  <View style={styles.rows}>
                    {item.rows.map((r, i) => (
                      <View key={`${r.left}-${i}`} style={styles.rowLine}>
                        <View style={{ flex: 1 }}><Text style={styles.rowLeft} numberOfLines={1}>{r.left}</Text>{r.sub ? <Text style={styles.rowSub} numberOfLines={1}>{r.sub}</Text> : null}</View>
                        <Text style={styles.rowRight}>{r.right}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Pressable onPress={() => setShare(item)} style={styles.shareBtn}><Ionicons name="share-social" size={18} color={bg} /><Text style={[styles.shareText, { color: bg }]}>{t('Share this')}</Text></Pressable>
              </View>
            )}
          />
        )}
        {slides.length ? (
          <View style={styles.bottom}>
            <View style={styles.dots}>{slides.map((_, i) => <View key={i} style={[styles.dot, i === index && styles.dotActive]} />)}</View>
            <Pressable onPress={next} style={styles.next}><Text style={{ color: bg, fontWeight: '800', fontSize: 16 }}>{index >= slides.length - 1 ? t('Done') : t('Next')}</Text></Pressable>
          </View>
        ) : null}
      </SafeAreaView>
      <ShareCardModal visible={share !== null} onClose={() => setShare(null)}>
        {share ? (
          <ShareCard title={share.kicker} subtitle={t('This week’s story')}>
            <BigNumber value={share.big} label={share.text} tone={share.tone ?? 'neutral'} />
            {share.rows ? <Rows rows={share.rows} /> : null}
          </ShareCard>
        ) : <View />}
      </ShareCardModal>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  brand: { color: 'rgba(255,255,255,0.85)', fontWeight: '800', letterSpacing: 0.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingHorizontal: Spacing.five },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.five, gap: Spacing.two },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  kicker: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  big: { color: '#fff', fontSize: 40, lineHeight: 46, fontWeight: '900', textAlign: 'center' },
  text: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 22, textAlign: 'center' },
  rows: { alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: Spacing.three, gap: 8, marginTop: Spacing.two },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowLeft: { color: '#fff', fontWeight: '600', fontSize: 15 },
  rowSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  rowRight: { color: '#fff', fontWeight: '800', fontSize: 15 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: Spacing.three },
  shareText: { fontWeight: '800' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#fff', width: 22 },
  next: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
});
