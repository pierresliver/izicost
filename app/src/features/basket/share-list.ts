// Share or download a shopping list: plain text (WhatsApp, any app) or a .txt file.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking, Share } from 'react-native';

import { t } from '@/lib/i18n';

import type { BasketItem } from './api';
import './i18n';

const qtyText = (q: number) => (Number.isInteger(q) ? String(q) : String(q).replace('.', ','));

/** The list as people would write it on paper: one line per item, ticked ones marked. */
export function listAsText(name: string, items: BasketItem[]): string {
  const lines = items.map((i) => `${i.checked ? '☑' : '☐'} ${i.name}${i.qty !== 1 ? ` × ${qtyText(i.qty)}` : ''}${i.brand_pref ? ` (${i.brand_pref})` : ''}`);
  return `${t('Shopping list')}: ${name}\n${lines.join('\n')}\n\n${t('Made with IziCost')}`;
}

/** Straight to WhatsApp when it is installed; otherwise the normal share sheet. Returns false when nothing happened. */
export async function sendToWhatsApp(text: string): Promise<boolean> {
  // openURL directly: on Android 11+ canOpenURL needs a manifest <queries> entry, openURL does not.
  try { await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`); return true; }
  catch { return shareText(text); } // WhatsApp not installed: the normal share sheet
}

export async function shareText(text: string): Promise<boolean> {
  const res = await Share.share({ message: text, title: t('Shopping list') });
  return res.action === Share.sharedAction;
}

/** Writes the list to a .txt file in the cache and hands it to the system share/save sheet. */
export async function downloadList(name: string, items: BasketItem[]): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(t('Sharing is not available on this phone.'));
  const safe = name.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'list';
  // Previous list files go first (the receiving app may still be reading the one we hand over now, so that one stays;
  // the cache folder is private to the app and purgeable by the OS).
  try { for (const f of Paths.cache.list()) if (f instanceof File && /^izicost-.*\.txt$/.test(f.name)) f.delete(); } catch { /* best effort */ }
  const file = new File(Paths.cache, `izicost-${safe}.txt`);
  file.write(listAsText(name, items));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: t('Save or share the list') });
}
