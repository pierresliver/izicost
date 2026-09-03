// "Invite friends": IziCost only works when many people scan, so sharing must be one tap.
// Uses the phone's own share sheet (WhatsApp, SMS, email…) — no extra library, nothing sent by us.
import { Share } from 'react-native';

import { t } from '@/lib/i18n';

import './i18n';

/**
 * Where the invite points. Empty until there is a public download page or Play Store listing —
 * then put the link here (one place) and every invite message picks it up.
 */
export const APP_LINK = '';

export function inviteMessage(): string {
  const intro = t('I use IziCost to see where groceries are cheapest near me. Scan a receipt, and everyone sees where each product costs less — the more of us that scan, the better it gets.');
  const link = APP_LINK ? `${t('Get it here:')} ${APP_LINK}` : t('Ask me for the install file and I will send it to you.');
  return `${intro}\n\n${link}`;
}

/** Opens the share sheet. Resolves true when the sheet reported a share (Android cannot always tell). */
export async function shareApp(): Promise<boolean> {
  try {
    const res = await Share.share({ message: inviteMessage(), title: 'IziCost' });
    return res.action === Share.sharedAction;
  } catch {
    return false;
  }
}
