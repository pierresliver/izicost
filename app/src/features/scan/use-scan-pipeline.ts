// The one pipeline every entry point shares (camera, gallery, offline queue):
//   prepare -> check connection -> upload all photos -> ask the Edge Function -> /confirm
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { t } from '@/lib/i18n';
import { setPending } from '@/lib/pending';
import { prepareImage } from '@/lib/receipts';

import { extractReceiptPhotos, isOnline, looksLikeNetworkError, OfflineError, ScanLimitError, uploadPhotos } from './api';
import { dequeueScan, enqueueScan } from './queue';

export type Phase = 'idle' | 'preparing' | 'uploading' | 'reading';
export type ScanNotice = { kind: 'limit' | 'queued' | 'error'; message: string };
export type RunResult = 'ok' | 'offline' | 'limit' | 'error' | 'busy';

export type RunOptions = {
  /** Photos already went through prepareImage (camera + queue entries). */
  prepared?: boolean;
  /** Retrying an offline-queue entry: it is removed from the queue once the server has read it. */
  queueId?: string;
};

export function useScanPipeline() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ n: 0, total: 0 });
  const [photos, setPhotos] = useState<string[]>([]);
  const [notice, setNotice] = useState<ScanNotice | null>(null);
  const busyRef = useRef(false);

  const run = useCallback(async (localUris: string[], opts: RunOptions = {}): Promise<RunResult> => {
    if (busyRef.current || localUris.length === 0) return 'busy';
    busyRef.current = true;
    setNotice(null);
    setPhotos(localUris);
    let uris = localUris;
    try {
      setPhase('preparing');
      if (!opts.prepared) {
        uris = [];
        for (const u of localUris) uris.push(await prepareImage(u));
        setPhotos(uris);
      }
      if (!(await isOnline())) throw new OfflineError();

      setPhase('uploading');
      setProgress({ n: 1, total: uris.length });
      const imagePaths = await uploadPhotos(uris, (i) => setProgress({ n: i + 1, total: uris.length }));

      setPhase('reading');
      const { extraction, model } = await extractReceiptPhotos(imagePaths);
      if (opts.queueId) await dequeueScan(opts.queueId).catch(() => {});
      setPending({ extraction, raw: JSON.parse(JSON.stringify(extraction)), imagePaths, localUris: uris, model });
      setPhase('idle');
      router.push('/confirm');
      return 'ok';
    } catch (e) {
      setPhase('idle');
      if (e instanceof ScanLimitError) {
        setNotice({ kind: 'limit', message: t('You have reached today’s scan limit. Try again tomorrow.') });
        return 'limit';
      }
      const offline = looksLikeNetworkError(e) || !(await isOnline());
      if (offline) {
        if (!opts.queueId) await enqueueScan(uris).catch(() => {});
        setNotice({ kind: 'queued', message: t('Saved — will be read when you are back online') });
        return 'offline';
      }
      const msg = String((e as Error).message ?? e);
      setNotice({ kind: 'error', message: msg });
      Alert.alert(t('Could not read this receipt'), msg);
      return 'error';
    } finally {
      busyRef.current = false;
    }
  }, [router]);

  const clearNotice = useCallback(() => setNotice(null), []);
  const notify = useCallback((n: ScanNotice) => setNotice(n), []);
  const isRunning = useCallback(() => busyRef.current, []);

  return { phase, progress, photos, notice, run, clearNotice, notify, isRunning, busy: phase !== 'idle' };
}
