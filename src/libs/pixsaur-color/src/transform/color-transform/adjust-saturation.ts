/**
 * Ajuste la saturation d'un buffer RGBA.
 * Conversion en espace HSL, ajustement S, reconversion en RGB.
 * @param src     Uint8ClampedArray length = w*h*4
 * @param factor  facteur de saturation (1 = aucune modif, >1 = + saturé, <1 = désaturé)
 */
export function adjustSaturation(
  src: Uint8ClampedArray,
  factor: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length)

  for (let i = 0; i < src.length; i += 4) {
    // Extract RGB values [0-255] and normalize to [0-1]
    const r = src[i] / 255
    const g = src[i + 1] / 255
    const b = src[i + 2] / 255

    // Convert RGB to HSL
    const hsl = rgbToHsl(r, g, b)

    // Adjust saturation
    hsl.s = Math.min(1, Math.max(0, hsl.s * factor))

    // Convert HSL back to RGB
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l)

    // Store result back as [0-255] values
    out[i] = Math.round(rgb.r * 255)
    out[i + 1] = Math.round(rgb.g * 255)
    out[i + 2] = Math.round(rgb.b * 255)
    out[i + 3] = src[i + 3] // Preserve alpha channel
  }

  return out
}

/**
 * Convert RGB to HSL color space
 */
function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / delta + 2) / 6
        break
      case b:
        h = ((r - g) / delta + 4) / 6
        break
    }
  }

  return { h, s, l }
}

/**
 * Convert HSL to RGB color space
 */
function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  if (s === 0) {
    return { r: l, g: l, b: l }
  }

  const hueToRgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return {
    r: hueToRgb(p, q, h + 1 / 3),
    g: hueToRgb(p, q, h),
    b: hueToRgb(p, q, h - 1 / 3)
  }
}
