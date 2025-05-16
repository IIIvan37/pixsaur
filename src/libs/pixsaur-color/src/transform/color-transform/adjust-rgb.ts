/**
 * Ajuste les canaux R, G et B selon trois facteurs.
 *
 * @param src     Uint8ClampedArray RGBA
 * @param rFactor facteur pour R (1 = inchangé)
 * @param gFactor facteur pour G
 * @param bFactor facteur pour B
 * @returns       nouveau buffer RGBA
 */
export function adjustRGBChannels(
  src: Uint8ClampedArray,
  rFactor: number,
  gFactor: number,
  bFactor: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length)
  for (let i = 0; i < src.length; i += 4) {
    out[i] = Math.min(255, Math.max(0, src[i] * rFactor))
    out[i + 1] = Math.min(255, Math.max(0, src[i + 1] * gFactor))
    out[i + 2] = Math.min(255, Math.max(0, src[i + 2] * bFactor))
    out[i + 3] = src[i + 3]
  }
  return out
}
