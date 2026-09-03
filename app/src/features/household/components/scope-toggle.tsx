// "Me / Household" switch for Home and Reports. Renders nothing when the user is not in a household.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { Segmented } from '@/features/prices/components/segmented';
import { t } from '@/lib/i18n';

import { useHousehold, type Scope } from '../api';
import '../i18n';

export function ScopeToggle() {
  const { household, scope, setScope } = useHousehold();
  if (!household) return null;
  return (
    <View style={styles.row}>
      <View style={{ width: 190 }}>
        <Segmented<Scope> options={[{ key: 'me', label: t('Me') }, { key: 'household', label: t('Household') }]} value={scope} onChange={setScope} />
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={scope === 'household' ? 'people' : 'person'} size={14} color={Brand.primary} />
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={{ flex: 1 }}>
          {scope === 'household' ? household.name : t('Showing only your receipts')}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
