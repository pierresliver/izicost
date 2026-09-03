// One quiet line under a report's title: whose receipts the numbers cover. Nothing when not in a household.
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { t } from '@/lib/i18n';

import { useHousehold } from '../api';
import '../i18n';

export function ScopeCaption() {
  const { household, scope } = useHousehold();
  if (!household) return null;
  const whole = scope === 'household';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={whole ? 'people' : 'person'} size={14} color={Brand.primary} />
      <ThemedText type="small" style={{ color: Brand.primary, fontWeight: '600' }}>{whole ? `${t('Household')} · ${household.name}` : t('Only you')}</ThemedText>
    </View>
  );
}
