// Hands the freshly extracted receipt from the Scan screen to the Confirm screen without
// squeezing a big JSON object through the URL.
import type { Extraction } from './types';

export type Pending = {
  extraction: Extraction;
  raw: Extraction;
  /** Storage paths of every photo of this receipt, top to bottom (1–4). */
  imagePaths: string[];
  /** Local (resized) copies of the same photos, same order, for instant previews. */
  localUris: string[];
  model: string;
  /** Id of the offline-queue entry this came from, if any (removed after a successful save). */
  queueId?: string;
};

let pending: Pending | null = null;

export function setPending(p: Pending) { pending = p; }
export function takePending(): Pending | null { const p = pending; return p; }
export function clearPending() { pending = null; }
