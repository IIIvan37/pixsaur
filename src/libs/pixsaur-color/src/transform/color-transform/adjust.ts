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
    let r = src[i]
    let g = src[i + 1]
    let b = src[i + 2]

    // Apply all adjustments in sequence
    ;[r, g, b] = applyRgbMultiplicative(r, g, b, rFactor, gFactor, bFactor)
    ;[r, g, b] = applyTemperature(r, g, b, temperature)
    ;[r, g, b] = applyTint(r, g, b, tint)
    ;[r, g, b] = applyExposure(r, g, b, exposure)
    ;[r, g, b] = applyHighlightsShadows(r, g, b, highlights, shadows)
    ;[r, g, b] = applyBrightness(r, g, b, brightness)
    ;[r, g, b] = applyGammaCorrection(r, g, b, gamma)
    ;[r, g, b] = applyContrast(r, g, b, contrast)
    ;[r, g, b] = applyHslAdjustments(r, g, b, saturation, hueShift, vibrance)
    ;[r, g, b] = applyPosterization(r, g, b, posterization, posterizeStep)

    // Clamp final et écriture
    dst[i] = Math.round(Math.max(0, Math.min(255, r)))
    dst[i + 1] = Math.round(Math.max(0, Math.min(255, g)))
    dst[i + 2] = Math.round(Math.max(0, Math.min(255, b)))
    dst[i + 3] = src[i + 3]
  }

  return output
}

// Helper functions for individual adjustments

function applyRgbMultiplicative(
  r: number,
  g: number,
  b: number,
  rFactor: number,
  gFactor: number,
  bFactor: number
): [number, number, number] {
  return [r * rFactor, g * gFactor, b * bFactor]
}

function applyTemperature(
  r: number,
  g: number,
  b: number,
  temperature: number
): [number, number, number] {
  if (temperature === 0) return [r, g, b]

  const temp = temperature / 100
  return [
    r * (1 + temp * 0.3),
    g,
    b * (1 - temp * 0.3)
  ]
}

function applyTint(
  r: number,
  g: number,
  b: number,
  tint: number
): [number, number, number] {
  if (tint === 0) return [r, g, b]

  const tintVal = tint / 100
  return [
    r * (1 - tintVal * 0.15),
    g * (1 + tintVal * 0.3),
    b * (1 - tintVal * 0.15)
  ]
}

function applyExposure(
  r: number,
  g: number,
  b: number,
  exposure: number
): [number, number, number] {
  if (exposure === 0) return [r, g, b]

  const expFactor = 2 ** exposure
  return [r * expFactor, g * expFactor, b * expFactor]
}

function applyHighlightsShadows(
  r: number,
  g: number,
  b: number,
  highlights: number,
  shadows: number
): [number, number, number] {
  if (highlights === 0 && shadows === 0) return [r, g, b]

  const rf = Math.max(0, Math.min(255, r)) / 255
  const gf = Math.max(0, Math.min(255, g)) / 255
  const bf = Math.max(0, Math.min(255, b)) / 255
  const lum = 0.299 * rf + 0.587 * gf + 0.114 * bf // ITU-R BT.601

  let rOut = r
  let gOut = g
  let bOut = b

  // Highlights: affecte les zones claires (lum > 0.5)
  if (highlights !== 0 && lum > 0.5) {
    const highlightMask = (lum - 0.5) * 2 // 0 à 1
    const highlightFactor = 1 + (highlights / 100) * highlightMask
    rOut *= highlightFactor
    gOut *= highlightFactor
    bOut *= highlightFactor
  }

  // Shadows: affecte les zones sombres (lum < 0.5)
  if (shadows !== 0 && lum < 0.5) {
    const shadowMask = (0.5 - lum) * 2 // 0 à 1
    const shadowFactor = 1 + (shadows / 100) * shadowMask
    rOut *= shadowFactor
    gOut *= shadowFactor
    bOut *= shadowFactor
  }

  return [rOut, gOut, bOut]
}

function applyBrightness(
  r: number,
  g: number,
  b: number,
  brightness: number
): [number, number, number] {
  return [r * brightness, g * brightness, b * brightness]
}

function applyGammaCorrection(
  r: number,
  g: number,
  b: number,
  gamma: number
): [number, number, number] {
  if (gamma === 1) return [r, g, b]

  return [
    Math.max(0, r / 255) ** (1 / gamma) * 255,
    Math.max(0, g / 255) ** (1 / gamma) * 255,
    Math.max(0, b / 255) ** (1 / gamma) * 255
  ]
}

function applyContrast(
  r: number,
  g: number,
  b: number,
  contrast: number
): [number, number, number] {
  return [
    (r - 128) * contrast + 128,
    (g - 128) * contrast + 128,
    (b - 128) * contrast + 128
  ]
}

function applyHslAdjustments(
  r: number,
  g: number,
  b: number,
  saturation: number,
  hueShift: number,
  vibrance: number
): [number, number, number] {
  // RGB to HSL
  const [h, s, l] = rgbToHsl(r, g, b)

  // Hue rotation
  let adjustedH = h
  if (hueShift !== 0) {
    adjustedH = (h + hueShift / 360) % 1
    if (adjustedH < 0) adjustedH += 1
  }

  // Saturation
  let adjustedS = Math.max(0, Math.min(1, s * saturation))

  // Vibrance (booste couleurs ternes, préserve saturées)
  if (vibrance !== 0) {
    const vibranceFactor = vibrance / 100
    const vibranceBoost = vibranceFactor * (1 - adjustedS)
    adjustedS = Math.max(0, Math.min(1, adjustedS + vibranceBoost))
  }

  // HSL to RGB
  return hslToRgb(adjustedH, adjustedS, l)
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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

  return [r1 * 255, g1 * 255, b1 * 255]
}

function applyPosterization(
  r: number,
  g: number,
  b: number,
  posterization: number,
  posterizeStep: number
): [number, number, number] {
  if (posterization >= 256) return [r, g, b]

  return [
    Math.round(r / posterizeStep) * posterizeStep,
    Math.round(g / posterizeStep) * posterizeStep,
    Math.round(b / posterizeStep) * posterizeStep
  ]
}
