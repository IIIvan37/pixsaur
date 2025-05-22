import { Vector } from '../type'

function kCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  if (arr.length === k) return [arr]

  const [head, ...tail] = arr
  const withHead = kCombinations(tail, k - 1).map((c) => [head, ...c])
  const withoutHead = kCombinations(tail, k)
  return withHead.concat(withoutHead)
}

/**
 * Approximate luminance from RGB [0–1] using Rec. 709 Y formula.
 */
function luminance([r, g, b]: Vector): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function isDark(color: Vector): boolean {
  return luminance(color) < 0.2
}

function isBright(color: Vector): boolean {
  return luminance(color) > 0.8
}

/**
 * Selects the most contrasted subset of N colors from candidates
 * by maximizing the minimum pairwise distance, preferring sets
 * that contain both dark and bright entries.
 */
export function selectContrastedSubset(
  candidates: Vector[],
  size: number,
  distance: (a: Vector, b: Vector) => number
): Vector[] {
  if (candidates.length <= size) return candidates.slice(0, size)

  const indices = [...Array(candidates.length).keys()]
  const combinations = kCombinations(indices, size)

  let bestCombo: number[] = []
  let bestMinDist = -Infinity

  // Prioritize combinations with one dark and one bright color
  const filtered = combinations.filter((combo) => {
    const colors = combo.map((i) => candidates[i])
    return colors.some(isDark) && colors.some(isBright)
  })

  const combosToTest = filtered.length > 0 ? filtered : combinations

  for (const combo of combosToTest) {
    let minDist = Infinity

    for (let i = 0; i < combo.length; i++) {
      for (let j = i + 1; j < combo.length; j++) {
        const d = distance(candidates[combo[i]], candidates[combo[j]])
        if (d < minDist) minDist = d
        if (minDist <= bestMinDist) break
      }
    }

    if (minDist > bestMinDist) {
      bestMinDist = minDist
      bestCombo = combo
    }
  }

  return bestCombo.map((i) => candidates[i])
}
