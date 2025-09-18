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
 * 2. If the result is not yet filled to `topN`, it selects the remaining indices with the highest counts.
 * 3. If any count in `counts` meets or exceeds a threshold (10), then indices with counts below that threshold are ignored.
 * 4. The function ensures that the result contains at most `topN` indices.
 */

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
 * Core selection algorithm used by both CPU and GPU implementations
 * ✅ DRY principle: Single source of truth for color selection logic
 * ✅ Complexité réduite par décomposition en sous-fonctions
 */
export function selectTopIndicesCore(
  counts: ArrayLike<number>,
  preselectedIdx: number[],
  topN: number,
  options?: {
    threshold?: number
  }
): number[] {
  const { threshold = 10 } = options || {}

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

  // 3. Trier et logger les candidats
  const sortedCandidates = sortAndLogCandidates(candidates, counts)

  // 4. Compléter la sélection
  completeSelection(sortedCandidates, result, topN)

  return result
}

export function selectTopIndices(
  counts: Uint32Array,
  preselectedIdx: number[],
  topN: number
): number[] {
  return selectTopIndicesCore(counts, preselectedIdx, topN)
}
