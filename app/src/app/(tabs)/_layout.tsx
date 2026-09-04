import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';
import '@/features/basket/i18n';
import { BASKET_HREF } from '@/features/basket/routes';
import { t, useLang } from '@/lib/i18n';

/** The basket is the heart of the app: one tap away from the Home and Prices headers. */
function BasketButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(BASKET_HREF)} hitSlop={8} style={({ pressed }) => [styles.basketBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={t('My basket')}>
      <Ionicons name="basket" color="#fff" size={20} />
    </Pressable>
  );
}

export default function TabLayout() {
  useLang(); // re-render tab labels when the language changes
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Brand.primary,
        headerTitleStyle: { fontWeight: '700' },
        tabBarLabelStyle: { fontSize: 12 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('Home'),
          headerTitle: 'IziCost',
          headerRight: () => <BasketButton />,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="prices"
        options={{
          title: t('Prices'),
          headerRight: () => <BasketButton />,
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetags" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t('Scan'),
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.scanButton, focused && styles.scanButtonFocused]}>
              <Ionicons name="camera" color="#fff" size={30} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: t('Receipts'),
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t('Me'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  basketBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  scanButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  scanButtonFocused: { backgroundColor: Brand.primaryDark },
});
