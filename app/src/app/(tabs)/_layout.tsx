import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { t, useLang } from '@/lib/i18n';

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
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="prices"
        options={{
          title: t('Prices'),
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
