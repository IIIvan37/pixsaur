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
export function selectTopIndices(
  counts: Uint32Array,
  preselectedIdx: number[],
  topN: number
): number[] {
  const P = counts.length
  if (topN <= 0 || P === 0) {
    return []
  }

  // 1. Set initial avec pré‑sélection (uniques, dans l’ordre donné)
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

  // 2. On veut remplir jusqu’à topN avec les plus gros counts
  // Construire un tableau d’indices restants
  const rest: number[] = []
  for (let i = 0; i < P; i++) {
    if (counts[i] < 10) continue // skip low counts
    if (!used[i]) rest.push(i)
  }

  // 3. Tri partiel : ici on peut faire un tri complet sur rest car P est petit
  rest.sort((a, b) => counts[b] - counts[a])

  // 4. Compléter result
  for (const idx of rest) {
    result.push(idx)
    if (result.length === topN) break
  }

  return result
}
