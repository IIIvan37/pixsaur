/**
 * Ajuste le contraste d’un buffer RGBA.
 * @param src     Uint8ClampedArray length = w*h*4
 * @param factor  facteur de contraste (1 = aucune modif, >1 = contraste + fort, <1 = contraste + faible)
 */
export function adjustContrast(
  src: Uint8ClampedArray,
  factor: number
): Uint8ClampedArray {
  // contraste centré sur 128
  const out = new Uint8ClampedArray(src.length)
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = src[i + c]
      out[i + c] = Math.min(255, Math.max(0, (v - 128) * factor + 128))
    }
    out[i + 3] = src[i + 3]
  }
  return out
}
