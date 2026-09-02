// GPS capture with a soft prompt: we explain why before the OS asks, once.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

import { t } from '@/lib/i18n';

const ASKED_KEY = 'izicost.location.asked';
const DECLINED_KEY = 'izicost.location.declinedAt';
const DECLINE_DAYS = 7;

/** Forget a "Not now" so the explanation can be shown again (e.g. when the user taps "Near me"). */
export async function resetLocationAsk(): Promise<void> {
  await AsyncStorage.multiRemove([ASKED_KEY, DECLINED_KEY]).catch(() => {});
}

function softPrompt(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      t('Use your location?'),
      t('IziCost uses your position only to show prices near you and to remember which branch you shopped at. Your position is never shared.'),
      [
        { text: t('Not now'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('Continue'), onPress: () => resolve(true) },
      ],
    );
  });
}

/**
 * Returns the current position, or null when permission is refused or the fix fails.
 * The first time, a friendly explanation is shown before the system dialog.
 */
export async function captureLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      // "Not now" is respected for a week: no nagging on every scan.
      const declinedAt = Number(await AsyncStorage.getItem(DECLINED_KEY).catch(() => null));
      if (declinedAt && Date.now() - declinedAt < DECLINE_DAYS * 24 * 3600 * 1000) return null;
      const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
      if (!asked) {
        await AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
        if (!(await softPrompt())) {
          await AsyncStorage.setItem(DECLINED_KEY, String(Date.now())).catch(() => {});
          return null;
        }
      }
      status = (await Location.requestForegroundPermissionsAsync()).status;
      if (status !== 'granted') await AsyncStorage.setItem(DECLINED_KEY, String(Date.now())).catch(() => {});
    }
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
