/**
 * Selects the top indices from a given counts array, optionally including preselected indices.
 *
 * @param counts - A `Uint32Array` representing the counts for each index.
 * @param preselectedIdx - An array of indices that should be included in the result if valid.
 * @param topN - The maximum number of indices to select.
 * @returns An array of indices representing the top `topN` counts, including any valid preselected indices.
 *
 * The function works as follows:
 * 1. It starts by including the valid preselected indices in the result, ensuring no duplicates.
 * 2. It starts by including the valid preselected indices in the result, ensuring no duplicates.
 * 3. If any count in `counts` meets or exceeds a threshold (10), then indices with counts below that threshold are ignored.
 * 4. The function ensures that the result contains at most `topN` indices.
 */

// Helper functions for debugging CPC colors

/**
 * Ajoute les indices pré-sélectionnés au résultat
 */
function addPreselectedIndices(
  preselectedIdx: number[],
  result: number[],
  used: Uint8Array,
  topN: number
): boolean {
  for (const idx of preselectedIdx) {
    if (idx >= 0 && idx < used.length && !used[idx]) {
      result.push(idx)
      used[idx] = 1
      if (result.length === topN) {
        return true // Sélection terminée
      }
    }
  }
  return false // Continuer la sélection
}

/**
 * Filtre les candidats restants selon le seuil
 */
function filterCandidates(
  counts: ArrayLike<number>,
  used: Uint8Array,
  threshold: number
): number[] {
  const P = counts.length
  const applyThreshold = Array.from(counts).some((c) => c >= threshold)

  const rest: number[] = []
  for (let i = 0; i < P; i++) {
    if (!used[i] && (!applyThreshold || counts[i] >= threshold)) {
      rest.push(i)
    }
  }

  return rest
}

/**
 * Trie les candidats par ordre décroissant de fréquence
 */
function sortAndLogCandidates(
  candidates: number[],
  counts: ArrayLike<number>
): number[] {
  // Trier par ordre décroissant de counts
  candidates.sort((a, b) => counts[b] - counts[a])
  return candidates
}

/**
 * Complète le résultat avec les candidats restants
 */
function completeSelection(
  candidates: number[],
  result: number[],
  topN: number
): void {
  for (const idx of candidates) {
    result.push(idx)
    if (result.length === topN) {
      break
    }
  }
}

/**
 * Calcule les métriques de couleur (luminance, teinte, saturation) pour un indice de couleur
 */
function getColorMetrics(colorIndex: number, basePalette: readonly any[]) {
  if (!basePalette[colorIndex]) {
    return { luminance: 0.5, hue: 0, saturation: 0 }
  }
  const [r, g, b] = basePalette[colorIndex]
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  // Luminance (formule standard)
  const luminance = 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm

  // Calcul de la teinte (simplifié)
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const delta = max - min

  let hue = 0
  if (delta !== 0) {
    if (max === rNorm) hue = ((gNorm - bNorm) / delta) % 6
    else if (max === gNorm) hue = (bNorm - rNorm) / delta + 2
    else hue = (rNorm - gNorm) / delta + 4
    hue = hue * 60
    if (hue < 0) hue += 360
  }

  const saturation = max === 0 ? 0 : delta / max
  return { luminance, hue, saturation }
}

/**
 * Vérifie si deux couleurs sont trop similaires en teinte et luminance
 */
function areColorsTooSimilar(
  candidateMetrics: { luminance: number; hue: number },
  selectedMetrics: { luminance: number; hue: number },
  minHueDistance: number,
  minLuminanceDistance: number
): boolean {
  // Distance de teinte (circulaire)
  let hueDiff = Math.abs(candidateMetrics.hue - selectedMetrics.hue)
  if (hueDiff > 180) hueDiff = 360 - hueDiff

  // Distance de luminance
  const lumDiff = Math.abs(
    candidateMetrics.luminance - selectedMetrics.luminance
  )

  return hueDiff < minHueDistance && lumDiff < minLuminanceDistance
}

/**
 * DIVERSITÉ AMÉLIORÉE: Sélection avec diversité chromatique ET de luminance
 */
function selectDiverseCandidates(
  candidates: number[],
  counts: ArrayLike<number>,
  basePalette: readonly any[],
  _alreadySelected: number[] // Unused but kept for API compatibility
): number[] {
  if (candidates.length === 0) return []

  // Calculer métriques pour tous les candidats
  const colorMetrics = candidates.map((idx) => ({
    idx,
    count: counts[idx] || 0,
    ...getColorMetrics(idx, basePalette)
  }))

  // Trier par fréquence d'abord
  colorMetrics.sort((a, b) => b.count - a.count)

  const selected: number[] = []
  const targetCount = candidates.length <= 8 ? candidates.length : 16
  const minHueDistance = targetCount <= 4 ? 60 : 30
  const minLuminanceDistance = targetCount <= 4 ? 0.3 : 0.15

  // Sélection avec diversité
  for (const candidate of colorMetrics) {
    const isFirstColor = selected.length === 0
    if (isFirstColor) {
      selected.push(candidate.idx)
      continue
    }

    // Vérifier si la couleur est suffisamment différente
    const isTooSimilar = selected.some((selectedIdx) => {
      const selectedMetrics = getColorMetrics(selectedIdx, basePalette)
      return areColorsTooSimilar(
        candidate,
        selectedMetrics,
        minHueDistance,
        minLuminanceDistance
      )
    })

    if (!isTooSimilar) selected.push(candidate.idx)

    // Arrêter si on a assez de couleurs
    if (selected.length >= Math.min(candidates.length, 12)) break
  }

  // Compléter avec les couleurs restantes
  for (const candidate of colorMetrics) {
    if (selected.length >= candidates.length) break
    if (!selected.includes(candidate.idx)) selected.push(candidate.idx)
  }

  return selected
}

/**
 * Core selection algorithm used by both CPU and GPU implementations
 * DRY principle: Single source of truth for color selection logic
 * Complexité réduite par décomposition en sous-fonctions
 * OPTIMISATION: Diversité améliorée pour mode 0 (16 couleurs)
 */
export function selectTopIndicesCore(
  counts: ArrayLike<number>,
  preselectedIdx: number[],
  topN: number,
  options?: {
    threshold?: number
    diversityMode?: boolean
    basePalette?: readonly any[]
  }
): number[] {
  const { threshold = 10, diversityMode = false } = options || {}

  const P = counts.length
  if (topN <= 0 || P === 0) {
    return []
  }

  const result: number[] = []
  const used = new Uint8Array(P)

  // 1. Ajouter les indices pré-sélectionnés
  const isComplete = addPreselectedIndices(preselectedIdx, result, used, topN)
  if (isComplete) {
    return result
  }

  // 2. Filtrer les candidats restants
  const candidates = filterCandidates(counts, used, threshold)

  // 3. OPTIMISATION: Mode diversité pour palettes moyennes ET petites
  // Petites palettes (2-4 couleurs): diversité CRITIQUE pour éviter couleurs trop proches
  // Palettes moyennes (8-16 couleurs): diversité pour répartition chromatique
  if (diversityMode && topN <= 16 && options?.basePalette) {
    const diverseCandidates = selectDiverseCandidates(
      candidates,
      counts,
      options.basePalette,
      result
    )
    completeSelection(diverseCandidates, result, topN)
  } else {
    // 4. Mode standard: Trier par fréquence
    const sortedCandidates = sortAndLogCandidates(candidates, counts)
    completeSelection(sortedCandidates, result, topN)
  }

  return result
}

export function selectTopIndices(
  counts: Uint32Array,
  preselectedIdx: number[],
  topN: number,
  options?: {
    threshold?: number
    diversityMode?: boolean
    basePalette?: readonly any[]
  }
): number[] {
  return selectTopIndicesCore(counts, preselectedIdx, topN, options)
}
