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
 * 3. The function ensures that the result contains at most `topN` indices.
 */

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

export function selectTopIndices(
  counts: Uint32Array,
  preselectedIdx: number[],
  topN: number
): number[] {
  const P = counts.length
  if (topN <= 0 || P === 0) {
    return []
  }

  // 1. Ajouter les indices pré-sélectionnés dans l'ordre donné
  const result: number[] = []
  const used = new Uint8Array(P)
  for (const idx of preselectedIdx) {
    if (idx >= 0 && idx < P && !used[idx]) {
      result.push(idx)
      used[idx] = 1
      if (result.length === topN) {
        return result
      }
    }
  }

  // Determine if thresholding should be applied (any count >= 10)
  const THRESHOLD = 10
  const applyThreshold = counts.some((c) => c >= THRESHOLD)

  // 2. Filtrer les indices restants, en appliquant le seuil si nécessaire
  const rest: number[] = []
  for (let i = 0; i < P; i++) {
    if (!used[i] && (!applyThreshold || counts[i] >= THRESHOLD)) {
      rest.push(i)
    }
  }

  // 3. Trier les indices restants par ordre décroissant de counts
  rest.sort((a, b) => counts[b] - counts[a])

  // 4. Compléter le résultat avec les indices restants
  for (const idx of rest) {
    result.push(idx)
    if (result.length === topN) {
      break
    }
  }

  return result
}
