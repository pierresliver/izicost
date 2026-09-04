// A cheap, honest sharpness estimate without native image code: a small JPEG of a sharp photo is
// noticeably BIGGER than one of a blurred photo (blur removes the detail JPEG has to encode).
// We score every shot that way and flag the weak ones; the person still sees and decides.
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

/** JPEG bytes per thousand pixels of a 320-px-wide copy. Higher = more detail. 0 when it cannot be measured. */
export async function detailScore(uri: string): Promise<number> {
  try {
    const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 320 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
    const info = await FileSystem.getInfoAsync(small.uri);
    FileSystem.deleteAsync(small.uri, { idempotent: true }).catch(() => {});
    const bytes = info.exists && 'size' in info && typeof info.size === 'number' ? info.size : 0;
    const kpx = (small.width * small.height) / 1000; // portrait and landscape photos compared fairly
    return bytes > 0 && kpx > 0 ? Math.round(bytes / kpx) : 0;
  } catch {
    return 0;
  }
}

/** Below this many bytes per thousand pixels a shelf photo is almost certainly unreadable. */
export const MIN_DETAIL = 100;

/**
 * Which shots look blurry: below the absolute floor, or well below the typical shot of this walk
 * (so one soft photo among sharp ones is caught, without punishing a uniformly plain shelf).
 */
export function flagBlurry(scores: number[]): boolean[] {
  const measured = scores.filter((s) => s > 0).sort((a, b) => a - b);
  const median = measured.length ? measured[Math.floor(measured.length / 2)] : 0;
  const floor = Math.max(MIN_DETAIL, median * 0.55);
  return scores.map((s) => s > 0 && s < floor);
}
