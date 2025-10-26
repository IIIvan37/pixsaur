export function applyAdjustmentsInOnePass(
  input: ImageData,
  config: {
    rgb: { r: number; g: number; b: number } // facteur multiplicatif (1 = neutre)
    brightness: number // facteur (1 = neutre)
    contrast: number // facteur (1 = neutre)
    saturation: number // facteur (1 = neutre)
    hue: number // rotation de teinte en degrés (-180 à +180, 0 = neutre)
    vibrance: number // saturation intelligente (-100 à +100, 0 = neutre)
    temperature: number // balance bleu/orange (-100 à +100, 0 = neutre)
    tint: number // balance vert/magenta (-100 à +100, 0 = neutre)
    gamma: number // correction gamma (0.1 à 3.0, 1.0 = neutre)
    exposure: number // exposition en stops (-3 à +3, 0 = neutre)
    highlights: number // ajustement hautes lumières (-100 à +100, 0 = neutre)
    shadows: number // ajustement ombres (-100 à +100, 0 = neutre)
    posterization: number // nombre de niveaux (256 = neutre)
  }
): ImageData {
  const output = new ImageData(input.width, input.height)
  const src = input.data
  const dst = output.data

  const { r: rFactor, g: gFactor, b: bFactor } = config.rgb
  const brightness = config.brightness
  const contrast = config.contrast
  const saturation = config.saturation
  const hueShift = config.hue ?? 0
  const vibrance = config.vibrance ?? 0
  const temperature = config.temperature ?? 0
  const tint = config.tint ?? 0
  const gamma = config.gamma ?? 1
  const exposure = config.exposure ?? 0
  const highlights = config.highlights ?? 0
  const shadows = config.shadows ?? 0
  const posterization = config.posterization ?? 256

  const posterizeStep = 255 / (posterization - 1)

  for (let i = 0; i < src.length; i += 4) {
    // Étape 1: RGB multiplicatif
    let r = src[i] * rFactor
    let g = src[i + 1] * gFactor
    let b = src[i + 2] * bFactor

    // Étape 2: Temperature (bleu/orange)
    if (temperature !== 0) {
      const temp = temperature / 100
      r *= 1 + temp * 0.3
      b *= 1 - temp * 0.3
    }

    // Étape 3: Tint (vert/magenta)
    if (tint !== 0) {
      const tintVal = tint / 100
      g *= 1 + tintVal * 0.3
      r *= 1 - tintVal * 0.15
      b *= 1 - tintVal * 0.15
    }

    // Étape 4: Exposure (stops)
    if (exposure !== 0) {
      const expFactor = 2 ** exposure
      r *= expFactor
      g *= expFactor
      b *= expFactor
    }

    // Étape 5: Highlights/Shadows
    if (highlights !== 0 || shadows !== 0) {
      const rf = Math.max(0, Math.min(255, r)) / 255
      const gf = Math.max(0, Math.min(255, g)) / 255
      const bf = Math.max(0, Math.min(255, b)) / 255
      const lum = 0.299 * rf + 0.587 * gf + 0.114 * bf // ITU-R BT.601

      // Highlights: affecte les zones claires (lum > 0.5)
      if (highlights !== 0 && lum > 0.5) {
        const highlightMask = (lum - 0.5) * 2 // 0 à 1
        const highlightFactor = 1 + (highlights / 100) * highlightMask
        r *= highlightFactor
        g *= highlightFactor
        b *= highlightFactor
      }

      // Shadows: affecte les zones sombres (lum < 0.5)
      if (shadows !== 0 && lum < 0.5) {
        const shadowMask = (0.5 - lum) * 2 // 0 à 1
        const shadowFactor = 1 + (shadows / 100) * shadowMask
        r *= shadowFactor
        g *= shadowFactor
        b *= shadowFactor
      }
    }

    // Étape 6: Brightness
    r *= brightness
    g *= brightness
    b *= brightness

    // Étape 7: Gamma correction
    if (gamma !== 1) {
      r = Math.max(0, r / 255) ** (1 / gamma) * 255
      g = Math.max(0, g / 255) ** (1 / gamma) * 255
      b = Math.max(0, b / 255) ** (1 / gamma) * 255
    }

    // Étape 8: Contraste
    r = (r - 128) * contrast + 128
    g = (g - 128) * contrast + 128
    b = (b - 128) * contrast + 128

    // Étape 9: Saturation + Hue + Vibrance via HSL
    const rf = Math.max(0, Math.min(255, r)) / 255
    const gf = Math.max(0, Math.min(255, g)) / 255
    const bf = Math.max(0, Math.min(255, b)) / 255

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

    // Hue rotation
    if (hueShift !== 0) {
      h = (h + hueShift / 360) % 1
      if (h < 0) h += 1
    }

    // Saturation
    s = Math.max(0, Math.min(1, s * saturation))

    // Vibrance (booste couleurs ternes, préserve saturées)
    if (vibrance !== 0) {
      const vibranceFactor = vibrance / 100
      const vibranceBoost = vibranceFactor * (1 - s)
      s = Math.max(0, Math.min(1, s + vibranceBoost))
    }

    // HSL → RGB
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

    // Étape 10: Posterization
    let rp = r1 * 255
    let gp = g1 * 255
    let bp = b1 * 255

    if (posterization < 256) {
      rp = Math.round(rp / posterizeStep) * posterizeStep
      gp = Math.round(gp / posterizeStep) * posterizeStep
      bp = Math.round(bp / posterizeStep) * posterizeStep
    }

    // Clamp final et écriture
    dst[i] = Math.round(Math.max(0, Math.min(255, rp)))
    dst[i + 1] = Math.round(Math.max(0, Math.min(255, gp)))
    dst[i + 2] = Math.round(Math.max(0, Math.min(255, bp)))
    dst[i + 3] = src[i + 3]
  }

  return output
}
