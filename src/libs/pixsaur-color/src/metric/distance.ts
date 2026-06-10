import type { ColorSpace, Vector } from '../type'

/**
 * Calculates the Euclidean distance between two vectors.
 *
 * @param {Vector} a - The first vector.
 * @param {Vector} b - The second vector.
 * @returns {number} - The Euclidean distance between the two vectors.
 */
export function euclideanDistance(a: Vector, b: Vector): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2
  }
  return sum
}

/**
 * Calculates the CIE76 distance between two colors in the Lab color space.
 *
 * @param {Vector} a - The first color in Lab space.
 * @param {Vector} b - The second color in Lab space.
 * @returns {number} - The CIE76 distance between the two colors.
 */
export const cie76Distance = euclideanDistance

/**
 * Calculates the weighted RGB distance using perceptual coefficients.
 * Reflects human eye sensitivity: ~2× more sensitive to green than red, ~5× more than blue.
 * Based on ITU-R BT.601 (SDTV) luma coefficients.
 *
 * @param {Vector} a - The first color in RGB space [0-255].
 * @param {Vector} b - The second color in RGB space [0-255].
 * @returns {number} - The weighted RGB distance squared (for performance).
 */
export function weightedRGBDistance(a: Vector, b: Vector): number {
  const [r1, g1, b1] = a
  const [r2, g2, b2] = b

  // ITU-R BT.601 luma coefficients (perceptual weights)
  const dr = (r1 - r2) ** 2 * 0.299
  const dg = (g1 - g2) ** 2 * 0.587
  const db = (b1 - b2) ** 2 * 0.114

  return dr + dg + db
}

/**
 * "Redmean" low-cost perceptual color distance (used by dithertron).
 * Weights red/blue by the mean red level and green ~4x, approximating
 * human color perception better than flat weighted-RGB. Returns the squared
 * magnitude (sqrt omitted: monotonic, so argmin is preserved) for speed.
 *
 * @param {Vector} a - The first color in RGB space [0-255].
 * @param {Vector} b - The second color in RGB space [0-255].
 * @returns {number} - The (squared) redmean distance.
 */
export function redmeanDistance(a: Vector, b: Vector): number {
  const [r1, g1, b1] = a
  const [r2, g2, b2] = b
  const rmean = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return (
    ((512 + rmean) * dr * dr) / 256 +
    4 * dg * dg +
    ((767 - rmean) * db * db) / 256
  )
}

/**
 * Calculates the Delta E 2000 distance between two colors in the Lab color space.
 *
 * @param {Vector} a - The first color in Lab space.
 * @param {Vector} b - The second color in Lab space.
 * @returns {number} - The Delta E 2000 distance between the two colors.
 */
export function deltaE2000Distance(a: Vector, b: Vector): number {
  const [L1, a1, b1] = a
  const [L2, a2, b2] = b

  const avgLp = (L1 + L2) / 2
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const avgC = (C1 + C2) / 2

  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)))
  const a1p = a1 * (1 + G)
  const a2p = a2 * (1 + G)

  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const avgCp = (C1p + C2p) / 2

  const h1p = Math.atan2(b1, a1p) * (180 / Math.PI)
  const h2p = Math.atan2(b2, a2p) * (180 / Math.PI)

  const h1p_mod = h1p >= 0 ? h1p : h1p + 360
  const h2p_mod = h2p >= 0 ? h2p : h2p + 360

  let deltahp = 0
  if (Math.abs(h1p_mod - h2p_mod) <= 180) {
    deltahp = h2p_mod - h1p_mod
  } else {
    deltahp =
      h2p_mod <= h1p_mod ? h2p_mod - h1p_mod + 360 : h2p_mod - h1p_mod - 360
  }

  const deltaLp = L2 - L1
  const deltaCp = C2p - C1p
  const deltaHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((deltahp * Math.PI) / 360)

  const avgHp =
    Math.abs(h1p_mod - h2p_mod) > 180
      ? (h1p_mod + h2p_mod + 360) / 2
      : (h1p_mod + h2p_mod) / 2

  const T =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * avgHp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180)

  const deltaTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (avgLp - 50) ** 2) / Math.sqrt(20 + (avgLp - 50) ** 2)
  const Sc = 1 + 0.045 * avgCp
  const Sh = 1 + 0.015 * avgCp * T
  const Rt = -Math.sin((2 * deltaTheta * Math.PI) / 180) * Rc

  const deltaE = Math.sqrt(
    (deltaLp / Sl) ** 2 +
      (deltaCp / Sc) ** 2 +
      (deltaHp / Sh) ** 2 +
      Rt * (deltaCp / Sc) * (deltaHp / Sh)
  )

  return deltaE
}

export type DistanceFn = (a: Vector, b: Vector) => number

export type DistanceMetric =
  | 'euclidean'
  | 'weighted-rgb'
  | 'redmean'
  | 'cie76'
  | 'deltaE2000'

export const DISTANCE_METRICS_BY_COLORSPACE: Record<
  ColorSpace,
  DistanceMetric[]
> = {
  // redmean (dithertron) par défaut: perception couleur plus fine que weighted-rgb
  RGB: ['redmean', 'weighted-rgb', 'euclidean']
}

const distanceFnFromMetric: Record<DistanceMetric, DistanceFn> = {
  euclidean: euclideanDistance,
  'weighted-rgb': weightedRGBDistance,
  redmean: redmeanDistance,
  cie76: cie76Distance,
  deltaE2000: deltaE2000Distance
}

/**
 * Returns a distance function based on the specified color space and metric.
 *
 * @param {ColorSpace} colorSpace - The color space to use.
 * @param {DistanceMetric} metric - The distance metric to use.
 * @returns {DistanceFn} - The distance function for the specified color space and metric.
 * @throws {Error} - If the color space or metric is unsupported.
 */
export const getDistanceFn = (
  colorSpace: ColorSpace,
  metric: DistanceMetric
): DistanceFn => {
  const supportedMetrics = DISTANCE_METRICS_BY_COLORSPACE[colorSpace]
  if (!supportedMetrics) {
    throw new Error(`Unsupported color space: "${colorSpace}"`)
  }
  if (!supportedMetrics.includes(metric)) {
    throw new Error(
      `Distance metric "${metric}" not available for color space "${colorSpace}"`
    )
  }

  return distanceFnFromMetric[metric]
}
