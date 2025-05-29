const BAYER_MATRICES: Record<
  'bayer2x2' | 'bayer4x4',
  { size: number; matrix: number[][] }
> = {
  bayer2x2: {
    size: 2,
    matrix: [
      [0, 2],
      [3, 1]
    ]
  },
  bayer4x4: {
    size: 4,
    matrix: [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ]
  }
}

export function applyBayerDither(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Vector[],
  config: DitheringConfig,
  distFn: DistanceFn,
  mode: 'bayer2x2' | 'bayer4x4'
): Uint8ClampedArray {
  const { intensity } = config
  const out = new Uint8ClampedArray(width * height * 4)
  const { size, matrix } = BAYER_MATRICES[mode]

  const pixel = new Uint8Array(3)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const i4 = i * 4

      pixel[0] = src[i4]
      pixel[1] = src[i4 + 1]
      pixel[2] = src[i4 + 2]

      const bayerVal = matrix[y % size][x % size]
      const threshold = (bayerVal / (size * size) - 0.5) * intensity * 255

      const modified: Vector = [
        Math.min(255, Math.max(0, pixel[0] + threshold)),
        Math.min(255, Math.max(0, pixel[1] + threshold)),
        Math.min(255, Math.max(0, pixel[2] + threshold))
      ]

      // recherche couleur la plus proche
      let bestI = 0
      let bestD = Infinity
      for (let p = 0; p < palette.length; p++) {
        const d = distFn(modified, palette[p])
        if (d < bestD) {
          bestD = d
          bestI = p
        }
      }

      out[i4 + 0] = palette[bestI][0]
      out[i4 + 1] = palette[bestI][1]
      out[i4 + 2] = palette[bestI][2]
      out[i4 + 3] = 255
    }
  }

  return out
}

export function applyNoDither(
  bufCS: Float32Array,
  width: number,
  height: number,
  paletteCS: Float32Array[],
  paletteOut: Uint8ClampedArray[],
  distFn: DistanceFn
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  const pixelCS = new Float32Array(3)

  for (let i = 0; i < width * height; i++) {
    const j = i * 3
    pixelCS[0] = bufCS[j]
    pixelCS[1] = bufCS[j + 1]
    pixelCS[2] = bufCS[j + 2]

    let bestI = 0
    let bestD = Infinity
    for (let p = 0; p < paletteCS.length; p++) {
      const d = distFn(pixelCS, paletteCS[p])
      if (d < bestD) {
        bestD = d
        bestI = p
      }
    }

    const outIdx = i * 4
    const color = paletteOut[bestI]
    out[outIdx + 0] = color[0]
    out[outIdx + 1] = color[1]
    out[outIdx + 2] = color[2]
    out[outIdx + 3] = 255
  }

  return out
}

import {
  ColorSpaceDistanceMetric,
  DistanceFn,
  getDistanceFn
} from '../metric/distance'
import { DitheringConfig } from '../quant'
import { getColorSpaceToRgbFn, getRgbToColorSpaceFn } from '../space'
import { Vector, ColorSpace } from '../type'

export function applyFloydSteinbergDither(
  bufCS: Float32Array,
  width: number,
  height: number,
  paletteCS: Float32Array[],
  paletteOut: Uint8ClampedArray[],
  distFn: DistanceFn,
  intensity: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  const pixelCS = new Float32Array(3)
  const w3 = width * 3

  const offsets = [3, -3 + w3, w3, 3 + w3]
  const weights = [7 / 16, 3 / 16, 5 / 16, 1 / 16].map((w) => w * intensity)


  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx3 = (y * width + x) * 3
      pixelCS[0] = bufCS[idx3]
      pixelCS[1] = bufCS[idx3 + 1]
      pixelCS[2] = bufCS[idx3 + 2]

      // trouver couleur la plus proche
      let bestI = 0
      let bestD = Infinity
      for (let p = 0; p < paletteCS.length; p++) {
        const d = distFn(pixelCS, paletteCS[p])
        if (d < bestD) {
          bestD = d
          bestI = p
        }
      }

      const outIdx = (y * width + x) * 4
      const color = paletteOut[bestI]
      out[outIdx + 0] = color[0]
      out[outIdx + 1] = color[1]
      out[outIdx + 2] = color[2]
      out[outIdx + 3] = 255

      // diffusion erreur
      const err0 = pixelCS[0] - paletteCS[bestI][0]
      const err1 = pixelCS[1] - paletteCS[bestI][1]
      const err2 = pixelCS[2] - paletteCS[bestI][2]

      for (let k = 0; k < 4; k++) {
        const tx = x + (k === 0 || k === 3 ? 1 : -1)
        const ty = y + (k > 1 ? 1 : 0)
        if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue
        const t3 = idx3 + offsets[k]
        bufCS[t3 + 0] += err0 * weights[k]
        bufCS[t3 + 1] += err1 * weights[k]
        bufCS[t3 + 2] += err2 * weights[k]
      }
    }
  }

  return out
}

export function mapAndDither(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Vector[], // désormais dans l’espace de travail (Lab, XYZ, etc.)
  config: DitheringConfig,
  colorSpace: ColorSpace
): Uint8ClampedArray {
  const { mode, intensity } = config
  const N = width * height

  // Conversion image → colorspace
  const rgbToCS = getRgbToColorSpaceFn(colorSpace)
  const toRGB = getColorSpaceToRgbFn(colorSpace)
  const distFn = getDistanceFn(
    colorSpace,
    ColorSpaceDistanceMetric[colorSpace][0]
  )

  const bufCS = new Float32Array(N * 3)
  for (let i = 0, j = 0; i < srcData.length; i += 4, j += 3) {
    const cs = rgbToCS([srcData[i], srcData[i + 1], srcData[i + 2]])
    bufCS[j] = cs[0]
    bufCS[j + 1] = cs[1]
    bufCS[j + 2] = cs[2]
  }

  // Projection palette dans le bon espace
  const paletteCS = palette.map((v) => new Float32Array(v))
  const paletteOut = palette.map((v) => {
  return Uint8ClampedArray.from([...toRGB(v), 255])
})

  let out: Uint8ClampedArray

  if (mode === 'floydSteinberg') {
    out = applyFloydSteinbergDither(
      bufCS,
      width,
      height,
      paletteCS,
      paletteOut,
      distFn,
      intensity
    )
  } else if (mode === 'bayer2x2' || mode === 'bayer4x4') {
    // ❗️Bayer travaille en RGB directement, on reconvertit
    const paletteRGB = palette.map(toRGB)
    out = applyBayerDither(
      srcData,
      width,
      height,
      paletteRGB,
      config,
      distFn,
      mode
    )
  } else {
    console.warn(`Unsupported dithering mode: ${mode}`)
    out = new Uint8ClampedArray(N * 4)
  }

  return out
}

