// "Near me" radius: 2 / 5 / 10 / 25 km, remembered across screens.
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { t } from '@/lib/i18n';

import '../i18n';

import { RADIUS_OPTIONS, type RadiusKm } from '../use-scope';
import { Segmented } from './segmented';

export function RadiusPicker({ value, onChange }: { value: RadiusKm; onChange: (km: RadiusKm) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
      <ThemedText type="small" themeColor="textSecondary">{t('Radius')}</ThemedText>
      <View style={{ flex: 1 }}>
        <Segmented<`${RadiusKm}`>
          options={RADIUS_OPTIONS.map((km) => ({ key: `${km}` as `${RadiusKm}`, label: `${km} km` }))}
          value={`${value}` as `${RadiusKm}`}
          onChange={(k) => onChange(Number(k) as RadiusKm)}
        />
      </View>
    </View>
  );
}
