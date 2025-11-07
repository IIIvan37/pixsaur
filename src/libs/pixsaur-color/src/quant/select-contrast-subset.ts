import type { Vector } from '../type'
import { isBright, isDark, luminance } from '../utils/luminance'

// Re-export for backward compatibility
export { isBright, isDark, luminance } from '../utils/luminance'

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
 * Filtre les combinaisons pour garder celles avec au moins une couleur sombre et une claire
 */
function filterCombinationsByLuminance(
  combinations: number[][],
  preselected: Vector[],
  remaining: Vector[],
  isDarkRGB: (v: Vector) => boolean,
  isBrightRGB: (v: Vector) => boolean
): number[][] {
  return combinations.filter((combo) => {
    const colors = [...preselected, ...combo.map((i) => remaining[i])]
    return colors.some(isDarkRGB) && colors.some(isBrightRGB)
  })
}

/**
 * Calcule la distance minimale entre toutes les paires de couleurs
 */
function calculateMinDistanceInSet(
  colors: Vector[],
  distance: (a: Vector, b: Vector) => number,
  earlyExitThreshold: number
): number {
  let minDist = Infinity

  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const d = distance(colors[i], colors[j])
      if (d < minDist) minDist = d
      if (minDist <= earlyExitThreshold) return minDist
    }
  }

  return minDist
}

/**
 * Trouve la meilleure combinaison en maximisant la distance minimale
 */
function findBestCombination(
  combinations: number[][],
  preselected: Vector[],
  remaining: Vector[],
  distance: (a: Vector, b: Vector) => number
): number[] {
  let bestCombo: number[] = []
  let bestMinDist = -Infinity

  for (const combo of combinations) {
    const colors = [...preselected, ...combo.map((i) => remaining[i])]
    const minDist = calculateMinDistanceInSet(colors, distance, bestMinDist)

    if (minDist > bestMinDist) {
      bestMinDist = minDist
      bestCombo = combo
    }
  }

  return bestCombo
}

/**
 * Sélectionne un sous-ensemble de couleurs en maximisant le contraste
 * Algorithme glouton avec optimisations de performance
 *
 * @param candidates - List of colors in any color space
 * @param preselected - Already locked-in colors
 * @param size - Desired final number of colors
 * @param distance - Distance function in working space
 * @param toRGB - Projection function to RGB (for luminance test)
 */
export function selectContrastedSubset(
  candidates: readonly Vector[],
  preselected: Vector[],
  size: number,
  distance: (a: Vector, b: Vector) => number,
  toRGB: (v: Vector) => Vector<'RGB'>
): Vector[] {
  const preselectedSet = new Set(preselected.map((c) => c.join(',')))
  const remaining = candidates.filter((c) => !preselectedSet.has(c.join(',')))

  if (preselected.length >= size) {
    return preselected.slice(0, size)
  }

  const needed = size - preselected.length
  const indices = [...new Array(remaining.length).keys()]

  if (remaining.length < needed) {
    return [...preselected, ...remaining].slice(0, size)
  }

  const combinations = kCombinations(indices, needed)

  const isDarkRGB = (v: Vector) => isDark(toRGB([...v] as Vector<'RGB'>))
  const isBrightRGB = (v: Vector) => isBright(toRGB([...v] as Vector<'RGB'>))

  const filtered = filterCombinationsByLuminance(
    combinations,
    preselected,
    remaining,
    isDarkRGB,
    isBrightRGB
  )

  const combosToTest = filtered.length > 0 ? filtered : combinations

  const bestCombo = findBestCombination(
    combosToTest,
    preselected,
    remaining,
    distance
  )

  return [...preselected, ...bestCombo.map((i) => remaining[i])]
}

/**
 * Calcule les distances (totale et minimale) entre un candidat et les couleurs déjà sélectionnées
 */
function calculateCandidateDistances(
  candidate: Vector,
  selectedColors: Vector[],
  distance: (a: Vector, b: Vector) => number
): { totalDistance: number; minDistance: number } {
  let totalDistance = 0
  let minDistance = Infinity

  for (const selected of selectedColors) {
    const d = distance(candidate, selected)
    totalDistance += d
    minDistance = Math.min(minDistance, d)
  }

  return { totalDistance, minDistance }
}

/**
 * Calcule le bonus de luminance pour encourager la diversité sombre/claire
 */
function calculateLuminanceBonus(
  candidateLuminance: number,
  selectedLuminances: number[]
): number {
  if (selectedLuminances.length === 0) return 0

  const hasVeryDark = selectedLuminances.some((l) => l < 0.2)
  const hasVeryBright = selectedLuminances.some((l) => l > 0.8)

  // Encourage les couleurs sombres si on n'en a pas
  if (!hasVeryDark && candidateLuminance < 0.2) {
    return 20
  }
  // Encourage les couleurs claires si on n'en a pas
  if (!hasVeryBright && candidateLuminance > 0.8) {
    return 20
  }

  return 0
}

/**
 * Calcule le score équilibré d'un candidat
 */
function calculateBalancedScore(
  candidate: Vector,
  selectedColors: Vector[],
  distance: (a: Vector, b: Vector) => number,
  toRGB: (v: Vector) => Vector<'RGB'>
): number {
  const { totalDistance, minDistance } = calculateCandidateDistances(
    candidate,
    selectedColors,
    distance
  )

  const avgDistance =
    selectedColors.length > 0 ? totalDistance / selectedColors.length : 0

  const candidateRGB = toRGB([...candidate] as Vector<'RGB'>)
  const candidateLum = luminance(candidateRGB)

  const selectedLuminances = selectedColors.map((c) =>
    luminance(toRGB([...c] as Vector<'RGB'>))
  )

  const luminanceBonus = calculateLuminanceBonus(
    candidateLum,
    selectedLuminances
  )

  // Score équilibré : distance moyenne + distance minimum + bonus luminance
  return avgDistance + minDistance * 0.5 + luminanceBonus
}

/**
 * Trouve le meilleur candidat selon le score équilibré
 */
function findBestBalancedCandidate(
  available: Vector[],
  selectedColors: Vector[],
  distance: (a: Vector, b: Vector) => number,
  toRGB: (v: Vector) => Vector<'RGB'>
): number {
  let bestIndex = 0
  let bestScore = -Infinity

  for (let i = 0; i < available.length; i++) {
    const candidate = available[i]
    const score = calculateBalancedScore(
      candidate,
      selectedColors,
      distance,
      toRGB
    )

    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  return bestIndex
}

/**
 * Version plus douce de la sélection contrastée pour les petites palettes (modes CPC 1-2)
 * Équilibre mieux fréquence d'usage et contraste visuel
 *
 * @param candidates - Couleurs candidates triées par fréquence
 * @param preselected - Couleurs déjà sélectionnées
 * @param size - Nombre final de couleurs désiré
 * @param distance - Fonction de distance dans l'espace de travail
 * @param toRGB - Fonction de conversion vers RGB pour test de luminance
 */
export function selectBalancedSubset(
  candidates: readonly Vector[],
  preselected: Vector[],
  size: number,
  distance: (a: Vector, b: Vector) => number,
  toRGB: (v: Vector) => Vector<'RGB'>
): Vector[] {
  const preselectedSet = new Set(preselected.map((c) => c.join(',')))
  const remaining = candidates.filter((c) => !preselectedSet.has(c.join(',')))

  if (preselected.length >= size) {
    return preselected.slice(0, size)
  }

  const needed = size - preselected.length
  if (remaining.length <= needed) {
    return [...preselected, ...remaining].slice(0, size)
  }

  const result = [...preselected]
  const available = [...remaining]

  // Stratégie plus douce : sélection glouton avec score équilibré
  for (let step = 0; step < needed; step++) {
    const bestIndex = findBestBalancedCandidate(
      available,
      result,
      distance,
      toRGB
    )

    result.push(available[bestIndex])
    available.splice(bestIndex, 1)
  }

  return result
}
