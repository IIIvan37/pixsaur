import { ColorSpace, Vector } from '../type'

/**
 * Calculates the Euclidean distance between two vectors.
 *
 * @param {Vector} a - The first vector.
 * @param {Vector} b - The second vector.
 * @returns {number} - The Euclidean distance between the two vectors.
 */
export function euclideanDistance(a: Vector, b: Vector): number {
  return a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0)
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
 * Calculates the Delta E 2000 distance between two colors in the Lab color space.
 *
 * @param {Vector} a - The first color in Lab space.
 * @param {Vector} b - The second color in Lab space.
 * @returns {number} - The Delta E 2000 distance between the two colors.
 */
export function deltaE2000(a: Vector, b: Vector): number {
  const [L1, a1, b1] = a
  const [L2, a2, b2] = b

  const avgLp = (L1 + L2) / 2
  const C1 = Math.sqrt(a1 * a1 + b1 * b1)
  const C2 = Math.sqrt(a2 * a2 + b2 * b2)
  const avgC = (C1 + C2) / 2

  const G =
    0.5 *
    (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))))
  const a1p = a1 * (1 + G)
  const a2p = a2 * (1 + G)

  const C1p = Math.sqrt(a1p * a1p + b1 * b1)
  const C2p = Math.sqrt(a2p * a2p + b2 * b2)
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

  const deltaTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2))
  const Rc =
    2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)))
  const Sl =
    1 +
    (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2))
  const Sc = 1 + 0.045 * avgCp
  const Sh = 1 + 0.015 * avgCp * T
  const Rt = -Math.sin((2 * deltaTheta * Math.PI) / 180) * Rc

  const deltaE = Math.sqrt(
    Math.pow(deltaLp / Sl, 2) +
      Math.pow(deltaCp / Sc, 2) +
      Math.pow(deltaHp / Sh, 2) +
      Rt * (deltaCp / Sc) * (deltaHp / Sh)
  )

  return deltaE
}

export type DistanceFn = (a: Vector, b: Vector) => number

export type DistanceMetric = 'euclidean' | 'cie76' | 'deltaE2000'

const ColorSpaceDistanceMetric: Record<ColorSpace, DistanceMetric[]> = {
  RGB: ['euclidean'],
  XYZ: ['euclidean'],
  Lab: ['cie76', 'deltaE2000']
}

const distanceFnFromMetric: Record<DistanceMetric, DistanceFn> = {
  euclidean: euclideanDistance,
  cie76: cie76Distance,
  deltaE2000: deltaE2000
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
  const supportedMetrics = ColorSpaceDistanceMetric[colorSpace]
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
