// Hands the freshly extracted receipt from the Scan screen to the Confirm screen without
// squeezing a big JSON object through the URL.
import type { Extraction } from './types';

type Pending = { extraction: Extraction; raw: Extraction; imagePath: string; localUri: string; model: string };

let pending: Pending | null = null;

export function setPending(p: Pending) { pending = p; }
export function takePending(): Pending | null { const p = pending; return p; }
export function clearPending() { pending = null; }
