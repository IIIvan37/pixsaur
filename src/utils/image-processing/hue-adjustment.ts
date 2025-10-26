/**
 * Applique un ajustement de teinte (Hue) à une image en utilisant l'espace colorimétrique HSL
 * @param imageData - ImageData source
 * @param hueShift - Rotation de la teinte en degrés (-180 à +180)
 * @returns Nouvelle ImageData avec la teinte ajustée
 */
export function applyHueAdjustment(
  imageData: ImageData,
  hueShift: number
): ImageData {
  // Si pas de décalage, retourner une copie de l'image
  if (hueShift === 0) {
    const result = new ImageData(imageData.width, imageData.height)
    result.data.set(imageData.data)
    return result
  }

  const result = new ImageData(imageData.width, imageData.height)
  const data = imageData.data
  const resultData = result.data

  // Normaliser le décalage de teinte entre 0 et 360
  const normalizedShift = ((hueShift % 360) + 360) % 360

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const a = data[i + 3]

    // Convertir RGB en HSL
    const { h, s, l } = rgbToHsl(r, g, b)

    // Appliquer le décalage de teinte
    const newH = (h + normalizedShift) % 360

    // Convertir HSL en RGB
    const { r: newR, g: newG, b: newB } = hslToRgb(newH, s, l)

    // Écrire les nouvelles valeurs
    resultData[i] = Math.round(newR * 255)
    resultData[i + 1] = Math.round(newG * 255)
    resultData[i + 2] = Math.round(newB * 255)
    resultData[i + 3] = a // Préserver l'alpha
  }

  return result
}

/**
 * Convertit RGB (0-1) en HSL
 * @returns {h: 0-360, s: 0-1, l: 0-1}
 */
function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  // Lightness
  const l = (max + min) / 2

  // Saturation
  let s = 0
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  }

  // Hue
  let h = 0
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6
    } else {
      h = ((r - g) / delta + 4) / 6
    }
  }

  return { h: h * 360, s, l }
}

/**
 * Convertit HSL en RGB (0-1)
 * @param h - Hue (0-360)
 * @param s - Saturation (0-1)
 * @param l - Lightness (0-1)
 * @returns {r: 0-1, g: 0-1, b: 0-1}
 */
function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  // Cas achromatique (gris)
  if (s === 0) {
    return { r: l, g: l, b: l }
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hNorm = h / 360

  return {
    r: hueToRgb(p, q, hNorm + 1 / 3),
    g: hueToRgb(p, q, hNorm),
    b: hueToRgb(p, q, hNorm - 1 / 3)
  }
}
