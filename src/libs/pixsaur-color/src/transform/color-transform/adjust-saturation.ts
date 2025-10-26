/**
 * Ajuste la saturation d’un buffer RGBA.
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
    // extraire RGB [0-255]
    const r = src[i] / 255
    const g = src[i + 1] / 255
    const b = src[i + 2] / 255
    // convert to HSL
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b)
    let h = 0,
      s = 0
    const l = (max + min) / 2
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }
      h /= 6
    }
    // adjust saturation
    s = Math.min(1, Math.max(0, s * factor))
    // HSL back to RGB
    let r1: number, g1: number, b1: number
    if (s === 0) {
      r1 = g1 = b1 = l
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1 / 6) return p + (q - p) * 6 * t
        if (t < 1 / 2) return q
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
        return p
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r1 = hue2rgb(p, q, h + 1 / 3)
      g1 = hue2rgb(p, q, h)
      b1 = hue2rgb(p, q, h - 1 / 3)
    }
    out[i] = Math.round(r1 * 255)
    out[i + 1] = Math.round(g1 * 255)
    out[i + 2] = Math.round(b1 * 255)
    out[i + 3] = src[i + 3]
  }
  return out
}
