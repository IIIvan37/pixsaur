import { quantizerLogger } from '../../../../utils/logger'

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
const CPC_COLOR_NAMES: Record<string, string> = {
  '0,0,128': 'Blue',
  '0,0,255': 'Bright Blue',
  '0,128,255': 'Sky Blue',
  '128,128,255': 'Pastel Blue',
  '0,255,255': 'Bright Cyan',
  '128,255,255': 'Pastel Cyan',
  '255,0,0': 'Bright Red',
  '128,0,0': 'Red',
  '255,0,128': 'Purple',
  '128,0,128': 'Magenta',
  '255,0,255': 'Bright Magenta',
  '128,0,255': 'Mauve',
  '0,128,0': 'Green',
  '0,255,0': 'Bright Green',
  '128,255,0': 'Lime',
  '128,128,0': 'Yellow',
  '255,255,0': 'Bright Yellow',
  '255,128,0': 'Orange',
  '0,0,0': 'Black',
  '255,255,255': 'Bright White',
  '128,128,128': 'White'
}

function getCPCColorName(color: any[]): string {
  const key = color.join(',')
  return CPC_COLOR_NAMES[key] || `RGB(${color.join(',')})`
}

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
 * ✅ DIVERSITÉ AMÉLIORÉE: Sélection avec diversité chromatique ET de luminance
 * Pour CPC Plus: évite les couleurs trop similaires en teinte et luminance
 */
function selectDiverseCandidates(
  candidates: number[],
  counts: ArrayLike<number>,
  basePalette: readonly any[],
  _alreadySelected: number[] // Unused but kept for API compatibility
): number[] {
  if (candidates.length === 0) return []

  // Calculer luminance ET teinte approximative des couleurs
  const getColorMetrics = (colorIndex: number) => {
    if (!basePalette[colorIndex]) {
      return { luminance: 0.5, hue: 0, saturation: 0 }
    }
    const [r, g, b] = basePalette[colorIndex]
    const rNorm = r / 255
    const gNorm = g / 255
    const bNorm = b / 255

    // Luminance
    const luminance = 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm

    // HSL pour la teinte
    const max = Math.max(rNorm, gNorm, bNorm)
    const min = Math.min(rNorm, gNorm, bNorm)
    const delta = max - min

    let hue = 0
    if (delta !== 0) {
      if (max === rNorm) {
        hue = ((gNorm - bNorm) / delta) % 6
      } else if (max === gNorm) {
        hue = (bNorm - rNorm) / delta + 2
      } else {
        hue = (rNorm - gNorm) / delta + 4
      }
      hue = hue * 60
      if (hue < 0) hue += 360
    }

    const saturation = max === 0 ? 0 : delta / max

    return { luminance, hue, saturation }
  }

  // Calculer métriques pour tous les candidats
  const colorMetrics = candidates.map((idx) => ({
    idx,
    count: counts[idx] || 0,
    ...getColorMetrics(idx)
  }))

  // Trier par fréquence d'abord (plus importantes restent prioritaires)
  colorMetrics.sort((a, b) => b.count - a.count)

  quantizerLogger.debug('🎨 Diversity Selection - Candidates by frequency:')
  quantizerLogger.debug(
    colorMetrics.slice(0, 10).map((m) => ({
      idx: m.idx,
      count: m.count,
      hue: Math.round(m.hue),
      luminance: m.luminance.toFixed(2),
      name: getCPCColorName(basePalette[m.idx])
    }))
  )

  // ✅ DIVERSITÉ CHROMATIQUE: Sélection avec distance minimale entre couleurs
  const selected: number[] = []

  // 🎯 Distance adaptative selon le nombre de candidats sélectionnés (= approximation de targetColors)
  // Pour CPC Plus avec palettes très petites: distances TRÈS strictes
  const targetCount = candidates.length <= 8 ? candidates.length : 16
  const minColorDistance = targetCount <= 4 ? 60 : 30 // Distance minimale en degrés de teinte
  const minLuminanceDistance = targetCount <= 4 ? 0.3 : 0.15 // Distance minimale en luminance

  quantizerLogger.debug(
    `🎨 Diversity Selection - Parameters: targetCount=${targetCount}, minHueDist=${minColorDistance}, minLumDist=${minLuminanceDistance}`
  )

  for (const candidate of colorMetrics) {
    if (selected.length === 0) {
      // Première couleur: prendre la plus fréquente
      selected.push(candidate.idx)
      quantizerLogger.debug(
        `🎨 Selected first color: ${getCPCColorName(basePalette[candidate.idx])} (idx ${candidate.idx})`
      )
      continue
    }

    // Vérifier la distance avec les couleurs déjà sélectionnées
    let tooSimilar = false
    for (const selectedIdx of selected) {
      const selectedMetrics = getColorMetrics(selectedIdx)

      // Distance de teinte (circulaire)
      let hueDiff = Math.abs(candidate.hue - selectedMetrics.hue)
      if (hueDiff > 180) hueDiff = 360 - hueDiff

      // Distance de luminance
      const lumDiff = Math.abs(candidate.luminance - selectedMetrics.luminance)

      // Couleurs trop similaires si teinte ET luminance proches
      if (hueDiff < minColorDistance && lumDiff < minLuminanceDistance) {
        tooSimilar = true
        quantizerLogger.debug(
          `🎨 Rejected ${getCPCColorName(basePalette[candidate.idx])}: too similar to ${getCPCColorName(basePalette[selectedIdx])} (hueDiff=${hueDiff.toFixed(1)}, lumDiff=${lumDiff.toFixed(2)})`
        )
        break
      }
    }

    if (!tooSimilar) {
      selected.push(candidate.idx)
      quantizerLogger.debug(
        `🎨 Selected color: ${getCPCColorName(basePalette[candidate.idx])} (idx ${candidate.idx})`
      )
    }

    // Si on a assez de couleurs diversifiées, arrêter
    if (selected.length >= Math.min(candidates.length, 12)) {
      break
    }
  }

  // Compléter avec les couleurs restantes si nécessaire
  for (const candidate of colorMetrics) {
    if (selected.length >= candidates.length) break
    if (!selected.includes(candidate.idx)) {
      selected.push(candidate.idx)
    }
  }

  return selected
}

/**
 * Core selection algorithm used by both CPU and GPU implementations
 * ✅ DRY principle: Single source of truth for color selection logic
 * ✅ Complexité réduite par décomposition en sous-fonctions
 * ✅ OPTIMISATION: Diversité améliorée pour mode 0 (16 couleurs)
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

  // 3. ✅ OPTIMISATION: Mode diversité pour palettes moyennes ET petites
  // Petites palettes (2-4 couleurs): diversité CRITIQUE pour éviter couleurs trop proches
  // Palettes moyennes (8-16 couleurs): diversité pour répartition chromatique
  if (diversityMode && topN <= 16 && options?.basePalette) {
    const modeLabel = topN <= 4 ? 'SMALL' : 'MEDIUM'
    quantizerLogger.info(
      `🎨 [DIVERSITY-${modeLabel}] Activating diversity mode for ${topN} colors from ${candidates.length} candidates`
    )
    const diverseCandidates = selectDiverseCandidates(
      candidates,
      counts,
      options.basePalette,
      result
    )
    completeSelection(diverseCandidates, result, topN)
    quantizerLogger.info(
      `🎨 [DIVERSITY] Selected ${result.length} colors with diversity optimization`
    )
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
