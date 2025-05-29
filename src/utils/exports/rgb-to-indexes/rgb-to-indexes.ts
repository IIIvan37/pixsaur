/**
 * Converts an RGBA buffer to an array of palette indices by finding the exact RGB match in the provided palette.
 *
 * @param rgbaBuf - The input buffer containing RGBA pixel data (Uint8ClampedArray). Each pixel is represented by 4 consecutive values (R, G, B, A).
 * @param palette - An array of RGB vectors representing the color palette. Each vector is a tuple of three numbers: [R, G, B].
 * @returns A Uint8Array where each element is the index of the corresponding pixel's color in the palette.
 * @throws {Error} If a pixel's RGB value is not found in the palette.
 */
import { Vector } from '@/libs/pixsaur-color/src/type'

function quantizeCPC(value: number): number {
  const levels = [0, 128, 255]
  let best = levels[0]
  let bestDist = Math.abs(value - best)

  for (const lvl of levels) {
    const dist = Math.abs(value - lvl)
    if (dist < bestDist) {
      bestDist = dist
      best = lvl
    }
  }

  return best
}

export function rgbToIndexBufferExact(
  rgbaBuf: Uint8ClampedArray,
  palette: Vector[]
): Uint8Array {
  const length = rgbaBuf.length / 4
  const indices = new Uint8Array(length)

  // Build a map for fast lookup
  const paletteMap = new Map<string, number>()
  palette.forEach(([r, g, b], idx) => {
    paletteMap.set(`${r},${g},${b}`, idx)
  })

  for (let i = 0; i < length; i++) {
    const off = i * 4
    const r = quantizeCPC(rgbaBuf[off])
    const g = quantizeCPC(rgbaBuf[off + 1])
    const b = quantizeCPC(rgbaBuf[off + 2])
    const key = `${r},${g},${b}`

    const idx = paletteMap.get(key)
    if (idx === undefined) {
      throw new Error(
        `Pixel RGB [${r}, ${g}, ${b}] non trouvé dans la palette.`
      )
    }
    indices[i] = idx
  }

  return indices
}

/**
 * Remappe les pixels de imgData vers la palette réduite.
 * @param imgData   L'ImageData source (RGBA).
 * @param reducedPalette  Palette CPC (composantes 0,128,255).
 * @returns         Un nouvel ImageData dont chaque pixel est dans reducedPalette.
 */
export function remapImageDataToPalette(
  imgData: ImageData,
  reducedPalette: Vector[]
): ImageData {
  const { width, height, data } = imgData
  const out = new Uint8ClampedArray(data.length)
  const colorCache = new Map<string, Vector>()

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = `${r},${g},${b}`

    let best: Vector
    if (colorCache.has(key)) {
      best = colorCache.get(key)!
    } else {
      let bestDist = Infinity
      best = reducedPalette[0]
      for (const [rc, gc, bc] of reducedPalette) {
        const dr = r - rc
        const dg = g - gc
        const db = b - bc
        const dist = dr * dr + dg * dg + db * db
        if (dist < bestDist) {
          bestDist = dist
          best = [rc, gc, bc]
        }
      }
      colorCache.set(key, best)
    }

    out[i] = best[0]
    out[i + 1] = best[1]
    out[i + 2] = best[2]
    out[i + 3] = data[i + 3] // preserve original alpha
  }

  return new ImageData(out, width, height)
}
