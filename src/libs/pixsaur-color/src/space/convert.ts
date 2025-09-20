import type { ColorSpace, Vector } from '../type'

export function getRgbToColorSpaceFn(
  colorSpace: ColorSpace
): (rgb: Vector) => Vector {
  if (colorSpace === 'RGB') {
    return (rgb: Vector) => [...rgb] as Vector
  }
  throw new Error(`Unsupported color space: ${colorSpace}`)
}

export function getColorSpaceToRgbFn(
  colorSpace: ColorSpace
): <CS extends ColorSpace = ColorSpace>(color: Vector<CS>) => Vector<'RGB'> {
  if (colorSpace === 'RGB') {
    return (color: Vector) => [...color] as Vector<'RGB'>
  }
  throw new Error(`Unsupported color space: ${colorSpace}`)
}
