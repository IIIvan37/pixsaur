/**
 * Cache global pour le mapping couleur source → index palette.
 *
 * Utilisé par la stratégie distinct-mapping pour garantir un mapping 1:1
 * entre les couleurs source et les couleurs de la palette finale,
 * au lieu de recalculer le plus proche pour chaque pixel.
 *
 * Ce cache est global car le mapping doit être partagé entre:
 * 1. La quantification (qui calcule le mapping)
 * 2. Le dithering (qui utilise le mapping)
 */

// Cache pour le mapping couleur source → index palette
// Clé: "r,g,b" de la couleur source
// Valeur: index dans la palette (0, 1, 2, ...)
let currentColorMapping: Map<string, number> | null = null

// Flag indiquant si le mode distinct-mapping est actif
let isDistinctMappingActive = false

/**
 * Définit le mapping couleur source → index palette.
 * Appelé par la stratégie distinct-mapping après avoir calculé le mapping.
 */
export function setColorMapping(mapping: Map<string, number> | null): void {
  currentColorMapping = mapping
  isDistinctMappingActive = mapping !== null && mapping.size > 0
}

/**
 * Récupère le mapping couleur source → index palette.
 * Retourne null si aucun mapping n'est actif.
 */
export function getColorMapping(): Map<string, number> | null {
  return currentColorMapping
}

/**
 * Vérifie si le mode distinct-mapping est actif.
 */
export function isDistinctMappingEnabled(): boolean {
  return isDistinctMappingActive
}

/**
 * Cherche l'index palette pour une couleur source donnée.
 * Retourne undefined si la couleur n'est pas dans le mapping.
 */
export function lookupColorIndex(
  r: number,
  g: number,
  b: number
): number | undefined {
  if (!currentColorMapping) return undefined
  const key = `${r},${g},${b}`
  return currentColorMapping.get(key)
}

/**
 * Efface le mapping (appelé quand on change d'image ou de stratégie).
 */
export function clearColorMapping(): void {
  currentColorMapping = null
  isDistinctMappingActive = false
}
