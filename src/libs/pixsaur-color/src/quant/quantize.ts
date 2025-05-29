import { buildHistogram } from '../histogram'
import { mapAndDither } from '../map'
import {

  DistanceFn,
  DistanceMetric,
  getDistanceFn
} from '../metric/distance'
import { getRgbToColorSpaceFn } from '../space'
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
  console.log('base palette:', basePalette)
  const { colorSpace, distanceMetric } = quantConfig

  const toW = getRgbToColorSpaceFn(colorSpace)

  const distFn: DistanceFn = getDistanceFn(colorSpace, distanceMetric)

  const vecs = bufferToVectors(buf)


  const workingPal = basePalette.map((c) => toW([...c] as Vector)) // projection W sans mutation

  const preIdx = preselected
    .map((c) =>
      basePalette.findIndex((p) => p[0] === c[0] && p[1] === c[1] && p[2] === c[2])
    )
    .filter((i) => i >= 0)

  if (preselected.length !== preIdx.length) {
    console.warn('Certaines couleurs pré-sélectionnées ne sont pas dans la base palette', preselected)
  }

const reducePalette = (limit: number): Vector[] => {
  if (preIdx.length >= limit) {
    return preIdx.map((i) => workingPal[i]) // déjà dans le bon colorSpace
  }

  const counts = new Uint32Array(
    buildHistogram(vecs.map(toW), workingPal, distFn)
  )
  console.log('counts:', counts)
  const idxs = selectTopIndices(counts, preIdx, limit)

  const selectedW = selectContrastedSubset(
    idxs.map((i) => workingPal[i]),
    preIdx.map((i) => workingPal[i]),
    limit,
    distFn
  )

  console.log('Selected colors (colorSpace):', selectedW)

  return selectedW
}




  return {
    quantize: reducePalette,
    dither(
      reducedPalette: Vector<'RGB'>[],
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
