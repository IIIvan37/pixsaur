/**
 * Mapping couleur source → index palette, produit par la stratégie
 * distinct-mapping pour garantir un mapping 1:1 entre les couleurs source et
 * les couleurs de la palette finale, au lieu de recalculer le plus proche pour
 * chaque pixel.
 *
 * Deux choses vivent ici, et il ne faut pas les confondre:
 *
 * 1. `lookupColorIndex` — pur. Le mapping arrive en argument. C'est ce que le
 *    dithering consomme.
 * 2. Le transport ambiant (`setColorMapping` / `getColorMapping` /
 *    `clearColorMapping`) — un passe-plat **interne aux adapters**, parce que
 *    la stratégie calcule le mapping loin sous l'interface du quantizer.
 *    Le use-case `quantizePalette` le vide immédiatement dans une valeur; plus
 *    personne ne doit le lire en aval, sinon une image hérite du mapping de la
 *    précédente.
 */

// Clé: "r,g,b" de la couleur source — construite par la stratégie
// distinct-mapping (`palette-strategies-v2.ts`).
export type SourceColorMapping = Map<string, number>

/**
 * Cherche l'index palette pour une couleur source donnée.
 * Retourne undefined si la couleur n'est pas dans le mapping.
 */
export function lookupColorIndex(
  mapping: SourceColorMapping | null | undefined,
  r: number,
  g: number,
  b: number
): number | undefined {
  if (!mapping) return undefined
  return mapping.get(`${r},${g},${b}`)
}

// ============================================================================
// Transport ambiant — interne aux adapters, à vider dès que possible
// ============================================================================

let currentColorMapping: SourceColorMapping | null = null

/**
 * Dépose le mapping calculé par la stratégie distinct-mapping.
 * Un mapping vide ne transporte rien.
 */
export function setColorMapping(mapping: SourceColorMapping | null): void {
  currentColorMapping = mapping !== null && mapping.size > 0 ? mapping : null
}

/**
 * Récupère le mapping déposé, ou null s'il n'y en a pas.
 */
export function getColorMapping(): SourceColorMapping | null {
  return currentColorMapping
}

/**
 * Vide le transport (changement d'image ou de stratégie).
 */
export function clearColorMapping(): void {
  currentColorMapping = null
}
