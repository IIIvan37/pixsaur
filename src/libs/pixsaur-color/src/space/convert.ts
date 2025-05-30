import { Vector, ColorSpace } from '../type'

const DELTA = 6 / 29 // ≃ 0.206893
const M = 3 * DELTA ** 2 // ≃ 7.787
const SHIFT = 4 / 29 // ≃ 0.1379

const REF_WHITE = {
  X: 95.047,
  Y: 100.0,
  Z: 108.883
}

const LAB_CONST = {
  EPSILON: 0.008856,
  KAPPA: 903.3,
  DELTA: 16 / 116
}

const SRGB_GAMMA = {
  A: 0.04045,
  B: 12.92,
  C: 2.4,
  D: 1 / 2.4,
  OFFSET: 0.055,
  THRESHOLD: 0.0031308
}

export function xyzToLab(v: Vector<'XYZ'>): Vector<'Lab'> {
  const [X, Y, Z] = v
  const x = X / REF_WHITE.X
  const y = Y / REF_WHITE.Y
  const z = Z / REF_WHITE.Z

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

  return [l, a, b]
}

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

export function rgbToXyz(rgb: Vector<'RGB'>): Vector<'XYZ'> {
  let [r, g, b] = rgb.map((v) => v / 255)

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

  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100

  return [x, y, z]
}

export function xyzToRgb(xyz: Vector<'XYZ'>): Vector<'RGB'> {
  let [x, y, z] = xyz.map((v) => v / 100)

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

  return [
    Math.min(Math.max(0, Math.round(r * 255)), 255),
    Math.min(Math.max(0, Math.round(g * 255)), 255),
    Math.min(Math.max(0, Math.round(b * 255)), 255)
  ]
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
      return (rgb: Vector) => [...rgb] as Vector
    default:
      throw new Error(`Unsupported color space: ${colorSpace}`)
  }
}

export function getColorSpaceToRgbFn(
  colorSpace: ColorSpace
): <CS extends ColorSpace = ColorSpace>(color: Vector<CS>) => Vector<'RGB'> {
  switch (colorSpace) {
    case 'Lab':
      return labToRgb
    case 'XYZ':
      return xyzToRgb
    case 'RGB':
      return (color: Vector) => [...color] as Vector<'RGB'>
    default:
      throw new Error(`Unsupported color space: ${colorSpace}`)
  }
}
