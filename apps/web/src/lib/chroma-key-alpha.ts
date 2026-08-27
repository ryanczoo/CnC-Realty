/**
 * Rewrites RGBA pixel data in place, turning color-distance-from-green into
 * alpha: pixels near the known chroma-key green become transparent, pixels
 * far from it (any real confetti color, regardless of brightness) stay
 * opaque. Unlike brightness-based keying, this doesn't fade dark-toned
 * foreground pixels just because they're dark.
 */
const KEY_R = 119;
const KEY_G = 253;
const KEY_B = 154;

// Measured real confetti pixels sit 114-195 units away from the key color;
// this transition band stays well clear of that, entirely in
// background/edge-noise territory.
const INNER_THRESHOLD = 30; // at or below this distance: fully transparent
const OUTER_THRESHOLD = 80; // at or above this distance: fully opaque
const RANGE = OUTER_THRESHOLD - INNER_THRESHOLD;

export function applyChromaKeyAlpha(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dr = r - KEY_R;
    const dg = g - KEY_G;
    const db = b - KEY_B;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    let alpha: number;
    if (dist <= INNER_THRESHOLD) {
      alpha = 0;
    } else if (dist >= OUTER_THRESHOLD) {
      alpha = 255;
    } else {
      alpha = Math.round(((dist - INNER_THRESHOLD) / RANGE) * 255);
    }
    data[i + 3] = alpha;

    // Suppress green spill on every foreground pixel, not just the
    // partial-alpha transition band. Motion-blurred confetti edges can
    // land far enough from the key color to read as fully opaque while
    // still carrying real green contamination baked into the source
    // footage -- that contamination isn't confined to the alpha boundary.
    if (alpha > 0 && g > Math.max(r, b)) {
      data[i + 1] = Math.max(r, b);
    }
  }
}
