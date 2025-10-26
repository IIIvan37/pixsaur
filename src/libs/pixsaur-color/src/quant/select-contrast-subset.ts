import type { Vector } from '../type'

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
 * Sélectionne un sous-ensemble de couleurs en maximisant le contraste
 * Algorithme glouton avec optimisations de performance
 *
 * @param candidates - List of colors in any color space
 * @param preselected - Already locked-in colors
 * @param size - Desired final number of colors
 * @param distance - Distance function in working space
 * @param toRGB - Projection function to RGB (for luminance test)
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
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
  const indices = [...Array(remaining.length).keys()]

  if (remaining.length < needed) {
    return [...preselected, ...remaining].slice(0, size)
  }

  const combinations = kCombinations(indices, needed)

  let bestCombo: number[] = []
  let bestMinDist = -Infinity

  const isDarkRGB = (v: Vector) => isDark(toRGB([...v] as Vector<'RGB'>))
  const isBrightRGB = (v: Vector) => isBright(toRGB([...v] as Vector<'RGB'>))

  const filtered = combinations.filter((combo) => {
    const colors = [...preselected, ...combo.map((i) => remaining[i])]
    return colors.some(isDarkRGB) && colors.some(isBrightRGB)
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
// eslint-disable-next-line sonarjs/cognitive-complexity
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
    let bestIndex = 0
    let bestScore = -Infinity

    for (let i = 0; i < available.length; i++) {
      const candidate = available[i]

      // Score = contraste moyen avec les déjà sélectionnées + bonus luminance
      let totalDistance = 0
      let minDistance = Infinity

      for (const selected of result) {
        const d = distance(candidate, selected)
        totalDistance += d
        minDistance = Math.min(minDistance, d)
      }

      const avgDistance = result.length > 0 ? totalDistance / result.length : 0

      // Bonus luminance : encourage la diversité sombre/claire
      const candidateRGB = toRGB([...candidate] as Vector<'RGB'>)
      const candidateLum = luminance(candidateRGB)

      let luminanceBonus = 0
      if (result.length > 0) {
        const resultLuminances = result.map((c) =>
          luminance(toRGB([...c] as Vector<'RGB'>))
        )
        const hasVeryDark = resultLuminances.some((l) => l < 0.2)
        const hasVeryBright = resultLuminances.some((l) => l > 0.8)

        // Encourage les couleurs sombres si on n'en a pas
        if (!hasVeryDark && candidateLum < 0.2) {
          luminanceBonus = 20
        }
        // Encourage les couleurs claires si on n'en a pas
        if (!hasVeryBright && candidateLum > 0.8) {
          luminanceBonus = 20
        }
      }

      // Score équilibré : distance moyenne + distance minimum + bonus luminance
      const score = avgDistance + minDistance * 0.5 + luminanceBonus

      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    result.push(available[bestIndex])
    available.splice(bestIndex, 1)
  }

  return result
}
