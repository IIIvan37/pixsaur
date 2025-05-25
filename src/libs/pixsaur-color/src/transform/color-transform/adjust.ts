export function applyAdjustmentsInOnePass(
  input: ImageData,
  config: {
    rgb: { r: number; g: number; b: number } // facteur multiplicatif (1 = neutre)
    brightness: number // facteur (1 = neutre)
    contrast: number // facteur (1 = neutre)
    saturation: number // facteur (1 = neutre)
  }
): ImageData {
  const output = new ImageData(input.width, input.height)
  const src = input.data
  const dst = output.data

  const { r: rFactor, g: gFactor, b: bFactor } = config.rgb
  const brightness = config.brightness
  const contrast = config.contrast
  const saturation = config.saturation

  for (let i = 0; i < src.length; i += 4) {
    // Étape 1 : RGB multiplicatif
    let r = src[i] * rFactor
    let g = src[i + 1] * gFactor
    let b = src[i + 2] * bFactor

    // Étape 2 : Brightness multiplicatif
    r *= brightness
    g *= brightness
    b *= brightness

    // Étape 3 : Contraste (centré sur 128)
    r = (r - 128) * contrast + 128
    g = (g - 128) * contrast + 128
    b = (b - 128) * contrast + 128

    // Étape 4 : Saturation via HSL
    const rf = r / 255
    const gf = g / 255
    const bf = b / 255

    const max = Math.max(rf, gf, bf)
    const min = Math.min(rf, gf, bf)
    let h = 0,
      s = 0
    const l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case rf:
          h = (gf - bf) / d + (gf < bf ? 6 : 0)
          break
        case gf:
          h = (bf - rf) / d + 2
          break
        case bf:
          h = (rf - gf) / d + 4
          break
      }
      h /= 6
    }

    s = Math.max(0, Math.min(1, s * saturation))

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

    // Clamp final et écriture
    dst[i] = Math.round(Math.max(0, Math.min(255, r1 * 255)))
    dst[i + 1] = Math.round(Math.max(0, Math.min(255, g1 * 255)))
    dst[i + 2] = Math.round(Math.max(0, Math.min(255, b1 * 255)))
    dst[i + 3] = src[i + 3]
  }

  return output
}
