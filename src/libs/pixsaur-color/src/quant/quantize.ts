import { buildHistogram } from '../histogram'
import { mapAndDither } from '../map'
import { DistanceFn, DistanceMetric, getDistanceFn } from '../metric/distance'
import { getColorSpaceToRgbFn, getRgbToColorSpaceFn } from '../space'
import { ColorSpace, Vector } from '../type'
import { selectContrastedSubset } from './select-contrast-subset'
import { selectTopIndices } from './select-to-indices'

export type DitheringMode = 'floydSteinberg' | 'bayer2x2' | 'bayer4x4'

export type DitheringConfig = {
  mode: DitheringMode
  intensity: number // de 0 (off) à 1 (plein)
}

export type QuantizeConfig = {
  colorSpace: ColorSpace
  distanceMetric: DistanceMetric
}

/**
 * Transforms an ImageData object into a cloned Uint8ClampedArray buffer.
 */
export function extractBuffer(imageData: ImageData): Uint8ClampedArray {
  return new Uint8ClampedArray(imageData.data)
}

export function bufferToVectors(data: Uint8ClampedArray): Vector<'RGB'>[] {
  const vectors: Vector<'RGB'>[] = []
  for (let i = 0; i < data.length; i += 4) {
    vectors.push([data[i], data[i + 1], data[i + 2]])
  }
  return vectors
}

type CreateQuantizerInput = {
  buf: Uint8ClampedArray
  width: number
  height: number
  basePalette: Vector<'RGB'>[]
  preselected: Vector<'RGB'>[]
  quantConfig: QuantizeConfig
}

export function createQuantizer({
  buf,
  width,
  height,
  basePalette,
  preselected,
  quantConfig
}: CreateQuantizerInput) {
  const { colorSpace, distanceMetric } = quantConfig

  const toW = getRgbToColorSpaceFn(colorSpace)
  const fromW = getColorSpaceToRgbFn(colorSpace)
  const distFn: DistanceFn = getDistanceFn(colorSpace, distanceMetric)

  const vecs = bufferToVectors(buf)

  const workingPal = basePalette.map((c) => toW([...c] as Vector))

  const preIdx = preselected
    .map((c) =>
      basePalette.findIndex(
        (p) => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]
      )
    )
    .filter((i) => i >= 0)

  const reducePalette = (limit: number): Vector[] => {
    const counts = new Uint32Array(
      buildHistogram(vecs.map(toW), workingPal, distFn)
    )
    const idxs = selectTopIndices(counts, preIdx, 16)

    const out = idxs.map((i) => workingPal[i])

    const selectedW = selectContrastedSubset(
      out,
      preIdx.map((i) => [...workingPal[i]] as Vector),
      limit,
      distFn,
      fromW
    )

    return selectedW
  }

  return {
    quantize: reducePalette,
    dither(
      reducedPalette: Vector[],
      dithering: DitheringConfig
    ): Uint8ClampedArray {
      return mapAndDither(
        new Uint8ClampedArray(buf), // copie défensive
        width,
        height,
        reducedPalette,
        dithering,
        colorSpace
      )
    }
  }
}
