import { Vector, ColorSpace } from '../type'

const DELTA = 6 / 29 // ≃ 0.206893
const M = 3 * DELTA ** 2 // ≃ 7.787
const SHIFT = 4 / 29 // ≃ 0.1379

/**
 * Represents the reference white point values for the CIE 1931 color space.
 * These values correspond to the D65 illuminant, which is commonly used as a standard
 * for daylight conditions.
 *
 * @property X - The X component of the reference white point (95.047).
 * @property Y - The Y component of the reference white point (100.0).
 * @property Z - The Z component of the reference white point (108.883).
 */
const REF_WHITE = {
  X: 95.047,
  Y: 100.0,
  Z: 108.883
}

const LAB_CONST = {
  EPSILON: 0.008856, // ε = (6/29)^3
  KAPPA: 903.3, // κ = (29/3)^3
  DELTA: 16 / 116 // pour la branche linéaire du transform()
}

/**
 * Constants used for sRGB gamma correction and linearization.
 * These values are used to convert between linear and non-linear sRGB color spaces.
 *
 * @property A - Threshold for applying the linear segment of the sRGB gamma curve.
 * @property B - Scaling factor for the linear segment of the inverse gamma curve.
 * @property C - Exponent used for linearizing the non-linear sRGB gamma curve.
 * @property D - Inverse exponent for applying the sRGB gamma curve.
 * @property OFFSET - Offset value used in the non-linear sRGB gamma equation.
 * @property THRESHOLD - Threshold for transitioning between linear and non-linear sRGB gamma.
 */
const SRGB_GAMMA = {
  A: 0.04045,
  B: 12.92, // inverse gamma linéaire
  C: 2.4, // exposant de linéarisation
  D: 1 / 2.4, // exposant inverse (gamma)
  OFFSET: 0.055,
  THRESHOLD: 0.0031308 // pour le passage linéaire→non linéaire
}

/**
 * Converts a color from the CIE 1931 XYZ color space to the CIE 1976 (Lab) color space.
 *
 * The input XYZ values are expected to be in the range [0, 100]. The function
 * normalizes these values based on the reference white point and applies a
 * transformation to convert them to Lab coordinates.
 *
 * @param v - A vector representing the XYZ color, where:
 *   - `v[0]` is the X component.
 *   - `v[1]` is the Y component.
 *   - `v[2]` is the Z component.
 *
 * @returns A vector representing the Lab color, where:
 *   - `v[0]` is the L* component.
 *   - `v[1]` is the a* component.
 *   - `v[2]` is the b* component.
 */
export function xyzToLab(v: Vector<'RGB'>): Vector<'Lab'> {
  let [x, y, z] = v
  x /= REF_WHITE.X
  y /= REF_WHITE.Y
  z /= REF_WHITE.Z

  const transform = (value: number) =>
    value > LAB_CONST.EPSILON
      ? Math.cbrt(value)
      : value * (LAB_CONST.KAPPA / 1160) + LAB_CONST.DELTA

  const fx = transform(x)
  const fy = transform(y)
  const fz = transform(z)

  const l = 116 * fy - 16
  const a = 500 * (fx - fy)
  const b = 200 * (fy - fz)

  v[0] = l
  v[1] = a
  v[2] = b
  return v
}

/**
 * Converts a color from the CIE 1976 (Lab) color space to the CIE 1931 XYZ color space.
 *
 * The input Lab values are expected to be in the range [0, 100] for L* and
 * [-128, 127] for a* and b*. The function applies a transformation to convert
 * them back to XYZ coordinates based on the reference white point.
 *
 * @param v - A vector representing the Lab color, where:
 *   - `v[0]` is the L* component.
 *   - `v[1]` is the a* component.
 *   - `v[2]` is the b* component.
 *
 * @returns A vector representing the XYZ color, where:
 *   - `v[0]` is the X component.
 *   - `v[1]` is the Y component.
 *   - `v[2]` is the Z component.
 */
export function labToXyz(v: Vector<'Lab'>): Vector<'XYZ'> {
  const [l, a, b] = v
  const fy = (l + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200

  const invTransform = (t: number) => (t > DELTA ? t ** 3 : (t - SHIFT) / M)

  const x = invTransform(fx) * REF_WHITE.X
  const y = invTransform(fy) * REF_WHITE.Y
  const z = invTransform(fz) * REF_WHITE.Z

  return [x, y, z]
}

export function rgbToLab(rgb: Vector<'RGB'>): Vector<'Lab'> {
  return xyzToLab(rgbToXyz(rgb))
}

export function labToRgb(lab: Vector<'Lab'>): Vector<'RGB'> {
  return xyzToRgb(labToXyz(lab))
}

/**
 * Converts a color from the RGB color space to the CIE 1931 XYZ color space.
 *
 * The input RGB values are expected to be in the range [0, 255]. The function
 * normalizes these values to the range [0, 1], applies an inverse gamma correction
 * (sRGB gamma transformation), and then converts the corrected RGB values to the
 * XYZ color space using the standard transformation matrix.
 *
 * @param v - A vector representing the RGB color, where:
 *   - `v[0]` is the red component (R) in the range [0, 255].
 *   - `v[1]` is the green component (G) in the range [0, 255].
 *   - `v[2]` is the blue component (B) in the range [0, 255].
 *
 * @returns A vector representing the XYZ color, where:
 *   - `v[0]` is the X component.
 *   - `v[1]` is the Y component.
 *   - `v[2]` is the Z component.
 */
export function rgbToXyz(v: Vector<'RGB'>): Vector<'XYZ'> {
  let [r, g, b] = v
  // Normalize RGB values (0-255) to [0, 1]
  r /= 255
  g /= 255
  b /= 255

  // Inverse gamma transformation using constants
  r =
    r > SRGB_GAMMA.A
      ? Math.pow(
          (r + SRGB_GAMMA.OFFSET) / (1 + SRGB_GAMMA.OFFSET),
          SRGB_GAMMA.C
        )
      : r / SRGB_GAMMA.B
  g =
    g > SRGB_GAMMA.A
      ? Math.pow(
          (g + SRGB_GAMMA.OFFSET) / (1 + SRGB_GAMMA.OFFSET),
          SRGB_GAMMA.C
        )
      : g / SRGB_GAMMA.B
  b =
    b > SRGB_GAMMA.A
      ? Math.pow(
          (b + SRGB_GAMMA.OFFSET) / (1 + SRGB_GAMMA.OFFSET),
          SRGB_GAMMA.C
        )
      : b / SRGB_GAMMA.B

  // Convert RGB -> XYZ
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100

  v[0] = x
  v[1] = y
  v[2] = z
  return v
}

/**
 * Converts a color from the CIE 1931 XYZ color space to the RGB color space.
 *
 * The input XYZ values are expected to be in the range [0, 100]. The function
 * applies a transformation to convert them to RGB coordinates using the standard
 * transformation matrix and then applies a gamma correction (sRGB gamma transformation).
 *
 * @param v - A vector representing the XYZ color, where:
 *   - `v[0]` is the X component.
 *   - `v[1]` is the Y component.
 *   - `v[2]` is the Z component.
 *
 * @returns A vector representing the RGB color, where:
 *   - `v[0]` is the red component (R) in the range [0, 255].
 *   - `v[1]` is the green component (G) in the range [0, 255].
 *   - `v[2]` is the blue component (B) in the range [0, 255].
 */
export function xyzToRgb(v: Vector<'XYZ'>): Vector<'RGB'> {
  let [x, y, z] = v
  x /= 100
  y /= 100
  z /= 100

  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
  let g = x * -0.969266 + y * 1.8760108 + z * 0.041556
  let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252

  r =
    r > SRGB_GAMMA.THRESHOLD
      ? (1 + SRGB_GAMMA.OFFSET) * Math.pow(r, SRGB_GAMMA.D) - SRGB_GAMMA.OFFSET
      : SRGB_GAMMA.B * r
  g =
    g > SRGB_GAMMA.THRESHOLD
      ? (1 + SRGB_GAMMA.OFFSET) * Math.pow(g, SRGB_GAMMA.D) - SRGB_GAMMA.OFFSET
      : SRGB_GAMMA.B * g
  b =
    b > SRGB_GAMMA.THRESHOLD
      ? (1 + SRGB_GAMMA.OFFSET) * Math.pow(b, SRGB_GAMMA.D) - SRGB_GAMMA.OFFSET
      : SRGB_GAMMA.B * b

  v[0] = Math.min(Math.max(0, Math.round(r * 255)), 255)
  v[1] = Math.min(Math.max(0, Math.round(g * 255)), 255)
  v[2] = Math.min(Math.max(0, Math.round(b * 255)), 255)
  return v
}
export function getRgbToColorSpaceFn(
  colorSpace: ColorSpace
): (rgb: Vector) => Vector {
  switch (colorSpace) {
    case 'Lab':
      return rgbToLab
    case 'XYZ':
      return rgbToXyz
    case 'RGB':
      return (rgb: Vector) => rgb
    default:
      throw new Error(`Unsupported color space: ${colorSpace}`)
  }
}

/**
 * Returns a function that converts a color from the specified color space to RGB.
 *
 * @param {ColorSpace} colorSpace - The color space to convert from.
 * @returns {function} - A function that takes a color in the specified color space
 *                       and returns its RGB representation.
 * @throws {Error} - If the color space is unsupported.
 */
export function getColorSpaceToRgbFn(
  colorSpace: ColorSpace
): <CS extends ColorSpace = ColorSpace>(color: Vector<CS>) => Vector<CS> {
  switch (colorSpace) {
    case 'Lab':
      return labToRgb
    case 'XYZ':
      return xyzToRgb
    case 'RGB':
      return (color: Vector) => color
    default:
      throw new Error(`Unsupported color space: ${colorSpace}`)
  }
}
