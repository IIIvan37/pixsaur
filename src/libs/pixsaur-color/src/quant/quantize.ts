import { buildHistogram } from '../histogram'
import { mapAndDither } from '../map'
import {
  ColorSpaceDistanceMetric,
  DistanceFn,
  DistanceMetric,
  getDistanceFn
} from '../metric/distance'
import { getRgbToColorSpaceFn, getColorSpaceToRgbFn } from '../space'
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
 *
 * @param imageData  ImageData from canvas.getImageData(...)
 * @returns          Cloned Uint8ClampedArray of imageData.data
 */
export function extractBuffer(imageData: ImageData): Uint8ClampedArray {
  // On clone les données pour ne pas muter l’original
  return new Uint8ClampedArray(imageData.data)
}

/**
 * Converts an ImageData object into an array of RGB vectors.
 *
 * @param imageData  ImageData from canvas.getImageData(...)
 * @returns          Array of RGB vectors
 */
export function imageDataToVectors(imageData: ImageData): Vector<'RGB'>[] {
  return bufferToVectors(extractBuffer(imageData))
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
  const { colorSpace } = quantConfig

  const toW: (c: Vector<'RGB'>) => Vector<typeof colorSpace> =
    getRgbToColorSpaceFn(colorSpace)
  const fromW: (c: Vector<typeof colorSpace>) => Vector<'RGB'> =
    getColorSpaceToRgbFn(colorSpace)
  const choosenMetric = ColorSpaceDistanceMetric[colorSpace][0]
  const distFn: DistanceFn = getDistanceFn(colorSpace, choosenMetric)

  const vecs = bufferToVectors(buf)
  // conversion de la palette et indices pré‑sélectionnés
  const workingPal = basePalette.map(toW)

  const preIdx = preselected
    .map((c) =>
      basePalette.findIndex(
        (p) => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]
      )
    )
    .filter((i) => i >= 0)

  if (preselected.length !== preIdx.length) {
    console.log('Bad preselected colors:', preselected)
  }

  const reducePalette = (limit: number): Vector<'RGB'>[] => {
    if (preIdx.length >= limit) {
      return preIdx.map((i) => fromW(workingPal[i])).slice(0, limit)
    }
    const counts = new Uint32Array(
      buildHistogram(vecs.map(toW), workingPal, distFn)
    )

    const idxs = selectTopIndices(counts, preIdx, 16)
    const out = selectContrastedSubset(
      idxs.map((i) => fromW(workingPal[i])),
      preIdx.map((i) => fromW(workingPal[i])),
      limit,
      distFn
    )
    console.log('out', out)
    return out
  }

  return {
    /**
     * Réduit la palette en fonction des pixels fournis.
     */
    quantize: reducePalette,

    /**
     * Applique map + dithering sur un tampon RGBA existant.
     */
    dither(
      reducedPalette: Vector<'RGB'>[],
      dithConfig: DitheringConfig
    ): Uint8ClampedArray {
      return mapAndDither(buf, width, height, reducedPalette, dithConfig)
    }
  }
}
