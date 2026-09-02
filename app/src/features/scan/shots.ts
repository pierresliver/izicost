// Hands the photos taken on the full-screen camera route back to the Scan tab, which owns the
// upload / read pipeline. Same idea as lib/pending.ts: in memory, never through the URL.
let shots: string[] | null = null;

export function setShots(uris: string[]): void { shots = uris; }
export function takeShots(): string[] | null { const s = shots; shots = null; return s; }
