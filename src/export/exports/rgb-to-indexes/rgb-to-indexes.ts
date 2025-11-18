/**
 * Converts an RGBA buffer to an array of palette indices by finding the exact RGB match in the provided palette.
 */
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { findDarkestColor } from '../color-utils'

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

function findDarkestColorIndex(palette: Vector[]): number {
  if (palette.length === 0) return 0

  const darkestColor = findDarkestColor(palette)
  const darkestKey = `${darkestColor[0]},${darkestColor[1]},${darkestColor[2]}`

  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette[i]
    if (`${r},${g},${b}` === darkestKey) {
      return i
    }
  }

  return 0
}

function buildPaletteMap(palette: Vector[]): Map<string, number> {
  const paletteMap = new Map<string, number>()
  for (const [idx, [r, g, b]] of palette.entries()) {
    paletteMap.set(`${r},${g},${b}`, idx)
  }
  return paletteMap
}

function quantizePixel(
  rgbaBuf: Uint8ClampedArray,
  offset: number,
  quantize: boolean
): [number, number, number] {
  const r = quantize ? quantizeCPC(rgbaBuf[offset]) : rgbaBuf[offset]
  const g = quantize ? quantizeCPC(rgbaBuf[offset + 1]) : rgbaBuf[offset + 1]
  const b = quantize ? quantizeCPC(rgbaBuf[offset + 2]) : rgbaBuf[offset + 2]
  return [r, g, b]
}

function findPaletteIndex(
  r: number,
  g: number,
  b: number,
  paletteMap: Map<string, number>,
  fallbackToDarkest: boolean,
  darkestColorIndex: number
): number {
  const key = `${r},${g},${b}`
  const idx = paletteMap.get(key)

  if (idx === undefined) {
    if (fallbackToDarkest) {
      return darkestColorIndex
    } else {
      throw new Error(
        `Pixel RGB [${r}, ${g}, ${b}] non trouvé dans la palette.`
      )
    }
  }

  return idx
}

export function rgbToIndexBufferExact(
  rgbaBuf: Uint8ClampedArray,
  palette: Vector[],
  quantize = true,
  fallbackToDarkest = false
): Uint8Array {
  const length = rgbaBuf.length / 4
  const indices = new Uint8Array(length)

  const paletteMap = buildPaletteMap(palette)
  const darkestColorIndex = fallbackToDarkest
    ? findDarkestColorIndex(palette)
    : 0

  for (let i = 0; i < length; i++) {
    const [r, g, b] = quantizePixel(rgbaBuf, i * 4, quantize)
    indices[i] = findPaletteIndex(
      r,
      g,
      b,
      paletteMap,
      fallbackToDarkest,
      darkestColorIndex
    )
  }

  return indices
}

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
    out[i + 3] = data[i + 3]
  }

  return new ImageData(out, width, height)
}
