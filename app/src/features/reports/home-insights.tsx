// Home cards driven by item history: "Due soon" (recurring items), inflation teaser, recap opt-in.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

import { dayShort } from './dates';
import type { Recurring } from './insights';
import { Card, SectionTitle, styles as ui } from './ui';

export function DueSoonCard({ items }: { items: Recurring[] }) {
  const theme = useTheme();
  if (!items.length) return null;
  return (
    <Card>
      <SectionTitle>{t('Due soon')}</SectionTitle>
      {items.slice(0, 5).map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center', paddingVertical: 4 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.backgroundSelected, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={r.daysUntilDue < 0 ? 'alarm' : 'time-outline'} size={18} color={r.daysUntilDue < 0 ? Brand.warning : Brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold" numberOfLines={1}>{r.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {t('about every %days% days', { days: r.everyDays })} · {t('last on %date%', { date: dayShort(r.lastDate) })}
            </ThemedText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ThemedText type="smallBold">{r.lastPrice != null ? formatMoney(r.lastPrice, r.currency) : '—'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ maxWidth: 110 }}>{r.lastStore}</ThemedText>
          </View>
        </View>
      ))}
    </Card>
  );
}

export function InflationTeaser({ pct, onPress }: { pct: number | null; onPress: () => void }) {
  if (pct === null) return null;
  const up = pct > 0;
  const color = Math.abs(pct) < 0.5 ? undefined : up ? Brand.danger : Brand.success;
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <Ionicons name={up ? 'trending-up' : 'trending-down'} size={26} color={color ?? Brand.primary} />
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">{t('Personal inflation')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Your basket costs %pct%% %dir% than 1–3 months ago', { pct: Math.abs(Math.round(pct * 10) / 10), dir: up ? t('more') : t('less') })}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#8A8F98" />
      </View>
    </Card>
  );
}

export function RecapAskCard({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
        <Ionicons name="notifications-outline" size={24} color={Brand.primary} />
        <ThemedText style={ui.sectionTitle}>{t('Get a weekly recap?')}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('Every Sunday at 18:00 we send one notification with your week in numbers. Nothing else.')}
      </ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one }}>
        <Pressable onPress={onYes} style={[ui.primaryBtn, { flex: 1, paddingVertical: 10 }]}>
          <ThemedText style={[ui.primaryBtnText, { fontSize: 15 }]}>{t('Yes, please')}</ThemedText>
        </Pressable>
        <Pressable onPress={onNo} style={[ui.primaryBtn, { flex: 1, paddingVertical: 10, backgroundColor: theme.backgroundSelected }]}>
          <ThemedText style={{ fontSize: 15, fontWeight: '700' }}>{t('Not now')}</ThemedText>
        </Pressable>
      </View>
    </Card>
  );
}
