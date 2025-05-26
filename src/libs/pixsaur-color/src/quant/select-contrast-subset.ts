import { Vector } from '../type'

function kCombinations<T>(
  arr: T[],
  k: number,
  memo = new Map<string, T[][]>()
): T[][] {
  const key = `${arr.length}|${k}`
  if (memo.has(key)) return memo.get(key)!

  if (k === 0) return [[]]
  if (arr.length < k) return []
  if (arr.length === k) return [arr]

  const [head, ...tail] = arr
  const withHead = kCombinations(tail, k - 1, memo).map((c) => [head, ...c])
  const withoutHead = kCombinations(tail, k, memo)
  const result = withHead.concat(withoutHead)
  memo.set(key, result)
  return result
}
/**
 * Approximate luminance from RGB [0–1] using Rec. 709 Y formula.
 */
export function luminance([r, g, b]: Vector): number {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export function isDark(color: Vector): boolean {
  return luminance(color) < 0.2
}

export function isBright(color: Vector): boolean {
  return luminance(color) > 0.8
}

/**
 * Selects the most contrasted subset of N colors from candidates
 * by maximizing the minimum pairwise distance, preferring sets
 * that contain both dark and bright entries.
 */
export function selectContrastedSubset(
  candidates: Vector[],
  preselected: Vector[],
  size: number,
  distance: (a: Vector, b: Vector) => number
): Vector[] {
  const preselectedSet = new Set(preselected.map((c) => c.join(',')))
  const remaining = candidates.filter((c) => !preselectedSet.has(c.join(',')))

  // Si trop de pré-sélectionnées, tronquer
  if (preselected.length >= size) {
    return preselected.slice(0, size)
  }

  const needed = size - preselected.length
  const indices = [...Array(remaining.length).keys()]

  // Cas où il n'y a pas assez de couleurs pour compléter la palette
  if (remaining.length < needed) {
    // Retourner tout ce qu'on peut (préselection + tout le reste)
    return [...preselected, ...remaining].slice(0, size)
  }

  const combinations = kCombinations(indices, needed)

  let bestCombo: number[] = []
  let bestMinDist = -Infinity

  const filtered = combinations.filter((combo) => {
    const colors = [...preselected, ...combo.map((i) => remaining[i])]
    return colors.some(isDark) && colors.some(isBright)
  })

  const combosToTest = filtered.length > 0 ? filtered : combinations

  for (const combo of combosToTest) {
    const colors = [...preselected, ...combo.map((i) => remaining[i])]
    let minDist = Infinity

    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const d = distance(colors[i], colors[j])
        if (d < minDist) minDist = d
        if (minDist <= bestMinDist) break
      }
    }

    if (minDist > bestMinDist) {
      bestMinDist = minDist
      bestCombo = combo
    }
  }

  return [...preselected, ...bestCombo.map((i) => remaining[i])]
}
