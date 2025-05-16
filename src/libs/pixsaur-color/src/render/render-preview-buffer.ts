const PIXEL_ASPECT: Record<0 | 1 | 2, { x: number; y: number }> = {
  0: { x: 2, y: 1 },
  1: { x: 1, y: 1 },
  2: { x: 1, y: 2 }
}

/**
 * Étire un tampon RGBA logique (width×height) vers 160×200
 * en simulant l’aspect non‑carré des pixels CPC.
 *
 * @param srcData  Uint8ClampedArray length = width*height*4
 * @param width    largeur logique
 * @param height   hauteur logique
 * @param mode     0|1|2 (CPC)
 * @returns        Uint8ClampedArray length = 160*200*4
 */
export function renderPreviewBuffer(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  mode: 0 | 1 | 2
): Uint8ClampedArray {
  const PREW = 160,
    PREH = 200
  const { x: aspectX, y: aspectY } = PIXEL_ASPECT[mode]
  const out = new Uint8ClampedArray(PREW * PREH * 4)

  for (let py = 0; py < PREH; py++) {
    let ly = Math.floor(py / aspectY)
    if (ly >= height) ly = height - 1

    for (let px = 0; px < PREW; px++) {
      let lx = Math.floor(px / aspectX)
      if (lx >= width) lx = width - 1

      const srcIdx = (ly * width + lx) * 4
      const dstIdx = (py * PREW + px) * 4

      out[dstIdx] = srcData[srcIdx]
      out[dstIdx + 1] = srcData[srcIdx + 1]
      out[dstIdx + 2] = srcData[srcIdx + 2]
      out[dstIdx + 3] = srcData[srcIdx + 3]
    }
  }

  return out
}
