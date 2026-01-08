/**
 * Utilitaire pour compter les couleurs uniques dans une image.
 * Utilisé pour détecter les images "low-color" (ex: C64, ZX Spectrum)
 * et appliquer une stratégie de mapping appropriée.
 */

/**
 * Compte le nombre de couleurs uniques dans une image.
 * S'arrête dès que maxToCount est dépassé pour optimiser les performances.
 *
 * @param data - Buffer RGBA de l'image (Uint8ClampedArray)
 * @param maxToCount - Nombre maximum de couleurs à compter avant de s'arrêter (défaut: 32)
 * @returns Le nombre de couleurs uniques (plafonné à maxToCount + 1 si dépassé)
 */
export function countUniqueColors(
  data: Uint8ClampedArray,
  maxToCount: number = 32
): number {
  const seen = new Set<number>()

  for (let i = 0; i < data.length; i += 4) {
    // Pack RGB en un seul entier 24-bit pour comparaison rapide
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    seen.add(key)

    // Early exit si on dépasse le seuil
    if (seen.size > maxToCount) {
      return seen.size
    }
  }

  return seen.size
}

/**
 * Extrait les couleurs uniques d'une image sous forme de vecteurs RGB.
 * Limité à maxColors pour éviter les problèmes de mémoire.
 *
 * @param data - Buffer RGBA de l'image
 * @param maxColors - Nombre maximum de couleurs à extraire (défaut: 32)
 * @returns Tableau de couleurs RGB [r, g, b][]
 */
export function extractUniqueColors(
  data: Uint8ClampedArray,
  maxColors: number = 32
): Array<[number, number, number]> {
  const seen = new Map<number, [number, number, number]>()

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = (r << 16) | (g << 8) | b

    if (!seen.has(key)) {
      seen.set(key, [r, g, b])
      if (seen.size >= maxColors) {
        break
      }
    }
  }

  return Array.from(seen.values())
}

/**
 * Détecte si une image est une image "retro" à faible nombre de couleurs.
 * Utile pour activer automatiquement la stratégie de mapping distinct.
 *
 * @param data - Buffer RGBA de l'image
 * @param threshold - Seuil de couleurs pour considérer l'image comme "low-color" (défaut: 16)
 * @returns true si l'image a <= threshold couleurs uniques
 */
export function isLowColorImage(
  data: Uint8ClampedArray,
  threshold: number = 16
): boolean {
  return countUniqueColors(data, threshold) <= threshold
}
