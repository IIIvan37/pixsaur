import type { Vector } from '../type'

/**
 * Calcule la teinte (hue) d'une couleur RGB en degrés (0-360)
 * Retourne -1 pour les couleurs achromatiques (gris)
 *
 * @param color - Couleur RGB [0-255, 0-255, 0-255]
 * @param deltaThreshold - Seuil en dessous duquel la couleur est considérée comme grise (default: 0.01)
 * @returns Teinte en degrés (0-360) ou -1 si achromatique
 *
 * @example
 * ```ts
 * calculateHue([255, 0, 0])     // ~0 (rouge)
 * calculateHue([0, 255, 0])     // ~120 (vert)
 * calculateHue([0, 0, 255])     // ~240 (bleu)
 * calculateHue([128, 128, 128]) // -1 (gris, achromatique)
 * ```
 */
export function calculateHue(color: Vector, deltaThreshold = 0.01): number {
  const r = color[0] / 255
  const g = color[1] / 255
  const b = color[2] / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  // Couleur achromatique (gris)
  if (delta < deltaThreshold) return -1

  let hue = 0
  if (max === r) {
    hue = ((g - b) / delta) % 6
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }

  hue *= 60
  if (hue < 0) hue += 360

  return hue
}

/**
 * Calcule la distance circulaire entre deux teintes (0-180)
 * Retourne 180 si l'une des couleurs est achromatique
 *
 * @param hue1 - Première teinte en degrés (0-360) ou -1 si achromatique
 * @param hue2 - Seconde teinte en degrés (0-360) ou -1 si achromatique
 * @returns Distance circulaire (0-180)
 *
 * @example
 * ```ts
 * calculateHueDistance(0, 90)    // 90
 * calculateHueDistance(0, 270)   // 90 (distance circulaire)
 * calculateHueDistance(10, 350)  // 20 (distance circulaire)
 * calculateHueDistance(-1, 120)  // 180 (achromatique)
 * ```
 */
export function calculateHueDistance(hue1: number, hue2: number): number {
  // Si l'une des couleurs est achromatique, considérer comme très différente
  if (hue1 < 0 || hue2 < 0) return 180

  let diff = Math.abs(hue1 - hue2)
  if (diff > 180) diff = 360 - diff
  return diff
}

/**
 * Calcule la saturation d'une couleur RGB (0-1)
 * Utilise la formule HSV: S = (max - min) / max
 *
 * @param color - Couleur RGB [0-255, 0-255, 0-255]
 * @returns Saturation (0-1), où 0 = gris, 1 = couleur pure
 *
 * @example
 * ```ts
 * calculateSaturation([255, 0, 0])     // 1.0 (rouge pur)
 * calculateSaturation([255, 128, 128]) // ~0.5 (rouge désaturé)
 * calculateSaturation([128, 128, 128]) // 0.0 (gris)
 * ```
 */
export function calculateSaturation(color: Vector): number {
  const r = color[0] / 255
  const g = color[1] / 255
  const b = color[2] / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max > 0 ? (max - min) / max : 0
}

/**
 * Calcule la valeur (value/brightness) d'une couleur RGB (0-1)
 * Utilise la formule HSV: V = max(R, G, B)
 *
 * @param color - Couleur RGB [0-255, 0-255, 0-255]
 * @returns Valeur (0-1), où 0 = noir, 1 = couleur la plus claire
 *
 * @example
 * ```ts
 * calculateValue([255, 0, 0])     // 1.0 (rouge vif)
 * calculateValue([128, 0, 0])     // ~0.5 (rouge sombre)
 * calculateValue([0, 0, 0])       // 0.0 (noir)
 * ```
 */
export function calculateValue(color: Vector): number {
  const max = Math.max(color[0], color[1], color[2])
  return max / 255
}

/**
 * Convertit une couleur RGB en HSV
 *
 * @param color - Couleur RGB [0-255, 0-255, 0-255]
 * @param deltaThreshold - Seuil pour détecter les couleurs achromatiques (default: 0.01)
 * @returns Objet { h: hue (0-360 ou -1), s: saturation (0-1), v: value (0-1) }
 *
 * @example
 * ```ts
 * rgbToHsv([255, 0, 0])     // { h: 0, s: 1, v: 1 } (rouge pur)
 * rgbToHsv([128, 128, 128]) // { h: -1, s: 0, v: ~0.5 } (gris)
 * ```
 */
export function rgbToHsv(
  color: Vector,
  deltaThreshold = 0.01
): { h: number; s: number; v: number } {
  return {
    h: calculateHue(color, deltaThreshold),
    s: calculateSaturation(color),
    v: calculateValue(color)
  }
}

/**
 * Calcule la distance de teinte minimale entre un candidat et un ensemble de couleurs
 * Ignore les couleurs peu saturées (gris) car leur teinte n'est pas significative
 *
 * @param candidateColor - Couleur candidate RGB [0-255, 0-255, 0-255]
 * @param selectedColors - Ensemble de couleurs RGB déjà sélectionnées
 * @param saturationThreshold - Seuil de saturation minimale pour considérer la teinte (default: 0.15)
 * @param deltaThreshold - Seuil pour détecter les couleurs achromatiques (default: 0.01)
 * @returns Distance de teinte minimale (0-180), ou 180 si le candidat est peu saturé
 *
 * @example
 * ```ts
 * calculateMinHueDistance([255, 0, 0], [[0, 255, 0], [0, 0, 255]]) // ~120
 * calculateMinHueDistance([128, 128, 128], [[255, 0, 0]]) // 180 (gris, pas de teinte significative)
 * ```
 */
export function calculateMinHueDistance(
  candidateColor: Vector,
  selectedColors: Vector[],
  saturationThreshold = 0.15,
  deltaThreshold = 0.01
): number {
  const candidateHue = calculateHue(candidateColor, deltaThreshold)
  const candidateSat = calculateSaturation(candidateColor)

  // Si le candidat est peu saturé, sa teinte n'est pas significative
  if (candidateSat < saturationThreshold) return 180

  let minDist = 180
  for (const selected of selectedColors) {
    const selectedSat = calculateSaturation(selected)
    // Ignorer les couleurs peu saturées dans la comparaison
    if (selectedSat < saturationThreshold) continue

    const selectedHue = calculateHue(selected, deltaThreshold)
    const dist = calculateHueDistance(candidateHue, selectedHue)
    minDist = Math.min(minDist, dist)
  }

  return minDist
}

/**
 * Calcule la distance de teinte minimale dans un ensemble de couleurs
 * Ignore les couleurs peu saturées (gris)
 *
 * @param colors - Ensemble de couleurs RGB [0-255, 0-255, 0-255]
 * @param saturationThreshold - Seuil de saturation minimale (default: 0.15)
 * @param deltaThreshold - Seuil pour détecter les couleurs achromatiques (default: 0.01)
 * @returns Distance de teinte minimale trouvée (0-180)
 *
 * @example
 * ```ts
 * calculateMinHueDistanceInSet([[255, 0, 0], [0, 255, 0], [0, 0, 255]]) // 120
 * calculateMinHueDistanceInSet([[255, 0, 0], [255, 128, 0]]) // ~30
 * ```
 */
export function calculateMinHueDistanceInSet(
  colors: Vector[],
  saturationThreshold = 0.15,
  deltaThreshold = 0.01
): number {
  let minHueDist = 180

  for (let i = 0; i < colors.length; i++) {
    const sat1 = calculateSaturation(colors[i])
    if (sat1 < saturationThreshold) continue

    const hue1 = calculateHue(colors[i], deltaThreshold)
    if (hue1 < 0) continue

    for (let j = i + 1; j < colors.length; j++) {
      const sat2 = calculateSaturation(colors[j])
      if (sat2 < saturationThreshold) continue

      const hue2 = calculateHue(colors[j], deltaThreshold)
      if (hue2 < 0) continue

      const dist = calculateHueDistance(hue1, hue2)
      minHueDist = Math.min(minHueDist, dist)
    }
  }

  return minHueDist
}

/**
 * Vérifie si une couleur est visuellement colorée (saturée et visible)
 * Une couleur doit avoir une saturation suffisante, une luminosité minimale et ne pas être trop claire
 *
 * @param color - Couleur RGB [0-255, 0-255, 0-255]
 * @param minSaturation - Saturation minimale (default: 0.3)
 * @param minLuminance - Luminance minimale (default: 0.2)
 * @param maxValue - Valeur/brightness maximale (default: 0.95)
 * @param highSaturationThreshold - Seuil de saturation élevée permettant une luminance plus basse (default: 0.7)
 * @param highSaturationMinLuminance - Luminance minimale pour couleurs très saturées (default: 0.15)
 * @returns true si la couleur est visuellement colorée
 *
 * @example
 * ```ts
 * isVisuallyColorful([255, 0, 0])      // true (rouge pur)
 * isVisuallyColorful([255, 200, 200])  // false (rose pâle, peu saturé)
 * isVisuallyColorful([128, 128, 128])  // false (gris)
 * isVisuallyColorful([50, 0, 0])       // false (rouge très sombre)
 * ```
 */
export function isVisuallyColorful(
  color: Vector,
  minSaturation = 0.3,
  minLuminance = 0.2,
  maxValue = 0.95,
  highSaturationThreshold = 0.7,
  highSaturationMinLuminance = 0.15
): boolean {
  const saturation = calculateSaturation(color)
  const value = calculateValue(color)

  // Import luminance from luminance module to avoid circular dependency
  // Use a simple approximation here or require it as parameter
  const lum = (color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722) / 255

  // Les couleurs très saturées peuvent avoir une luminance plus basse
  const effectiveMinLuminance =
    saturation > highSaturationThreshold
      ? highSaturationMinLuminance
      : minLuminance

  return (
    saturation >= minSaturation &&
    lum >= effectiveMinLuminance &&
    value <= maxValue
  )
}
