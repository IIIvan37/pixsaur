const BAYER_MATRICES: Record<
  'bayer2x2' | 'bayer4x4' | 'bayer8x8' | 'atkinson' | 'halftone4x4',
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
  },
  bayer8x8: {
    size: 8,
    matrix: [
      [0, 32, 8, 40, 2, 34, 10, 42],
      [48, 16, 56, 24, 50, 18, 58, 26],
      [12, 44, 4, 36, 14, 46, 6, 38],
      [60, 28, 52, 20, 62, 30, 54, 22],
      [3, 35, 11, 43, 1, 33, 9, 41],
      [51, 19, 59, 27, 49, 17, 57, 25],
      [15, 47, 7, 39, 13, 45, 5, 37],
      [63, 31, 55, 23, 61, 29, 53, 21]
    ]
  },
  atkinson: {
    size: 3,
    matrix: [
      [0, 1, 1],
      [1, 1, 1],
      [0, 1, 0]
    ]
  },
  halftone4x4: {
    size: 4,
    matrix: [
      [7, 13, 11, 4],
      [12, 16, 14, 8],
      [10, 15, 6, 2],
      [5, 9, 3, 1]
    ]
  }
}

function pseudoRandomVec(
  x: number,
  y: number,
  magnitude: number
): [number, number, number] {
  const seed = (x * 374761393 + y * 668265263) ^ (x * y)
  const h = (seed ^ (seed >>> 13)) * 1274126177
  const r1 = (((h >>> 0) & 0xff) / 255 - 0.5) * magnitude
  const r2 = (((h >>> 8) & 0xff) / 255 - 0.5) * magnitude
  const r3 = (((h >>> 16) & 0xff) / 255 - 0.5) * magnitude
  return [r1, r2, r3]
}

function applyAtkinsonDither(
  bufCS: Float32Array,
  width: number,
  height: number,
  paletteCS: Float32Array[],
  paletteOut: Uint8ClampedArray[],
  config: DitheringConfig,
  distFn: DistanceFn
): Uint8ClampedArray {
  const { intensity } = config
  const out = new Uint8ClampedArray(width * height * 4)
  const pixel = new Float32Array(3)
  const errorBuf = new Float32Array(bufCS) // copy

  // Atkinson diffusion offsets (relative to current pixel)
  const offsets = [
    [1, 0],
    [2, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [0, 2]
  ]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const i3 = idx * 3
      const i4 = idx * 4

      pixel[0] = errorBuf[i3]
      pixel[1] = errorBuf[i3 + 1]
      pixel[2] = errorBuf[i3 + 2]

      // Find nearest palette color
      let best = 0
      let bestD = Infinity
      for (let p = 0; p < paletteCS.length; p++) {
        const d = distFn(pixel, paletteCS[p])
        if (d < bestD) {
          bestD = d
          best = p
        }
      }

      const color = paletteOut[best]
      out[i4 + 0] = color[0]
      out[i4 + 1] = color[1]
      out[i4 + 2] = color[2]
      out[i4 + 3] = 255

      // Compute error
      const errR = (pixel[0] - paletteCS[best][0]) * intensity
      const errG = (pixel[1] - paletteCS[best][1]) * intensity
      const errB = (pixel[2] - paletteCS[best][2]) * intensity

      // Distribute error (1/8 to each neighbor)
      for (const [dx, dy] of offsets) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = (ny * width + nx) * 3
          errorBuf[nIdx + 0] += errR / 8
          errorBuf[nIdx + 1] += errG / 8
          errorBuf[nIdx + 2] += errB / 8
        }
      }
    }
  }

  return out
}

export function applyYliluoma1Dither(
  bufCS: Float32Array,
  width: number,
  height: number,
  paletteCS: Float32Array[],
  paletteOut: Uint8ClampedArray[],
  config: DitheringConfig,
  distFn: DistanceFn
): Uint8ClampedArray {
  const { intensity } = config
  const { size, matrix } = BAYER_MATRICES['bayer8x8']
  const out = new Uint8ClampedArray(width * height * 4)
  const pixel = new Float32Array(3)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const o = i * 4

      pixel[0] = bufCS[i * 3 + 0]
      pixel[1] = bufCS[i * 3 + 1]
      pixel[2] = bufCS[i * 3 + 2]

      const tx = x % size
      const ty = y % size
      const t = matrix[ty][tx] / (size * size) - 0.5
      const [dx, dy, dz] = pseudoRandomVec(x, y, intensity * t * 2 * 255)

      pixel[0] = Math.max(0, Math.min(255, pixel[0] + dx))
      pixel[1] = Math.max(0, Math.min(255, pixel[1] + dy))
      pixel[2] = Math.max(0, Math.min(255, pixel[2] + dz))

      let best = 0
      let minDist = Infinity
      for (let p = 0; p < paletteCS.length; p++) {
        const dist = distFn(pixel, paletteCS[p])
        if (dist < minDist) {
          minDist = dist
          best = p
        }
      }

      const [r, g, b] = paletteOut[best]
      out[o + 0] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = 255
    }
  }

  return out
}

export function applyYliluoma2Dither(
  bufCS: Float32Array,
  width: number,
  height: number,
  paletteCS: Float32Array[],
  paletteOut: Uint8ClampedArray[],
  config: DitheringConfig,
  distFn: DistanceFn
): Uint8ClampedArray {
  const { intensity } = config
  const { size, matrix } = BAYER_MATRICES['bayer8x8']
  const out = new Uint8ClampedArray(width * height * 4)
  const pixel = new Float32Array(3)
  const errorBuf = new Float32Array(width * height * 3)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const i3 = i * 3
      const o4 = i * 4

      const r = bufCS[i3 + 0] + errorBuf[i3 + 0]
      const g = bufCS[i3 + 1] + errorBuf[i3 + 1]
      const b = bufCS[i3 + 2] + errorBuf[i3 + 2]

      pixel[0] = r
      pixel[1] = g
      pixel[2] = b

      let best = 0,
        second = 0
      let bestD = Infinity,
        secondD = Infinity
      for (let p = 0; p < paletteCS.length; p++) {
        const d = distFn(pixel, paletteCS[p])
        if (d < bestD) {
          second = best
          secondD = bestD
          best = p
          bestD = d
        } else if (d < secondD) {
          second = p
          secondD = d
        }
      }

      const t = matrix[y % size][x % size] / (size * size)
      const w = Math.max(0, Math.min(1, (t - 0.5) * intensity + 0.5))
      const mix = w < 0.5 ? best : second

      const errR = r - paletteCS[mix][0]
      const errG = g - paletteCS[mix][1]
      const errB = b - paletteCS[mix][2]

      errorBuf[i3 + 0] = errR * intensity
      errorBuf[i3 + 1] = errG * intensity
      errorBuf[i3 + 2] = errB * intensity

      const [or, og, ob] = paletteOut[mix]
      out[o4 + 0] = or
      out[o4 + 1] = og
      out[o4 + 2] = ob
      out[o4 + 3] = 255
    }
  }

  return out
}

export function applyBayerDither(
  bufCS: Float32Array,
  width: number,
  height: number,
  paletteCS: Float32Array[],
  paletteOut: Uint8ClampedArray[],
  config: DitheringConfig,
  distFn: DistanceFn,
  mode: 'bayer2x2' | 'bayer4x4' | 'bayer8x8' | 'halftone4x4'
): Uint8ClampedArray {
  const { intensity } = config
  const out = new Uint8ClampedArray(width * height * 4)
  const { size, matrix } = BAYER_MATRICES[mode]
  const pixelCS = new Float32Array(3)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const i3 = i * 3
      const i4 = i * 4

      const bayerVal = matrix[y % size][x % size]
      const threshold = (bayerVal / (size * size) - 0.5) * intensity * 255

      pixelCS[0] = bufCS[i3] + threshold
      pixelCS[1] = bufCS[i3 + 1] + threshold
      pixelCS[2] = bufCS[i3 + 2] + threshold

      let bestI = 0
      let bestD = Infinity
      for (let p = 0; p < paletteCS.length; p++) {
        const d = distFn(pixelCS, paletteCS[p])
        if (d < bestD) {
          bestD = d
          bestI = p
        }
      }

      const rgb = paletteOut[bestI]
      out[i4 + 0] = rgb[0]
      out[i4 + 1] = rgb[1]
      out[i4 + 2] = rgb[2]
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
    const i3 = i * 3
    pixelCS[0] = bufCS[i3]
    pixelCS[1] = bufCS[i3 + 1]
    pixelCS[2] = bufCS[i3 + 2]

    let bestI = 0
    let bestD = Infinity
    for (let p = 0; p < paletteCS.length; p++) {
      const d = distFn(pixelCS, paletteCS[p])
      if (d < bestD) {
        bestD = d
        bestI = p
      }
    }

    console.log(bestI, paletteOut)
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

type DitherFn = (
  bufCS: Float32Array,
  width: number,
  height: number,
  paletteCS: Float32Array[],
  paletteOut: Uint8ClampedArray[],
  config: DitheringConfig,
  distFn: DistanceFn,
  mode?: string
) => Uint8ClampedArray

const DITHER_MODES: Record<string, DitherFn> = {
  none: (bufCS, width, height, paletteCS, paletteOut, _config, distFn) =>
    applyNoDither(bufCS, width, height, paletteCS, paletteOut, distFn),

  floydSteinberg: (
    bufCS,
    width,
    height,
    paletteCS,
    paletteOut,
    config,
    distFn
  ) =>
    applyFloydSteinbergDither(
      bufCS,
      width,
      height,
      paletteCS,
      paletteOut,
      distFn,
      config.intensity
    ),

  bayer2x2: (
    bufCS,
    width,
    height,
    paletteCS,
    paletteOut,
    config,
    distFn,
    mode
  ) =>
    applyBayerDither(
      bufCS,
      width,
      height,
      paletteCS,
      paletteOut,
      config,
      distFn,
      mode as 'bayer2x2'
    ),

  bayer4x4: (
    bufCS,
    width,
    height,
    paletteCS,
    paletteOut,
    config,
    distFn,
    mode
  ) =>
    applyBayerDither(
      bufCS,
      width,
      height,
      paletteCS,
      paletteOut,
      config,
      distFn,
      mode as 'bayer4x4'
    ),

  bayer8x8: (
    bufCS,
    width,
    height,
    paletteCS,
    paletteOut,
    config,
    distFn,
    mode
  ) =>
    applyBayerDither(
      bufCS,
      width,
      height,
      paletteCS,
      paletteOut,
      config,
      distFn,
      mode as 'bayer8x8'
    ),

  ylioluma1: (bufCS, width, height, paletteCS, paletteOut, config, distFn) =>
    applyYliluoma1Dither(
      bufCS,
      width,
      height,
      paletteCS,
      paletteOut,
      config,
      distFn
    ),

  ylioluma2: (bufCS, width, height, paletteCS, paletteOut, config, distFn) =>
    applyYliluoma2Dither(
      bufCS,
      width,
      height,
      paletteCS,
      paletteOut,
      config,
      distFn
    ),
  atkinson: (bufCS, width, height, paletteCS, paletteOut, config, distFn) =>
    applyAtkinsonDither(
      bufCS,
      width,
      height,
      paletteCS,
      paletteOut,
      config,
      distFn
    ),
  halftone4x4: (
    bufCS,
    width,
    height,
    paletteCS,
    paletteOut,
    config,
    distFn,
    mode
  ) =>
    applyBayerDither(
      bufCS,
      width,
      height,
      paletteCS,
      paletteOut,
      config,
      distFn,
      mode as 'halftone4x4'
    )
}
function buildPalette(
  palette: Vector[],
  toRGB: (v: Vector) => number[]
): { paletteOut: Uint8ClampedArray[]; paletteCS: Float32Array[] } {
  const seen = new Set<string>()
  const paletteOut: Uint8ClampedArray[] = []
  const paletteCS: Float32Array[] = []

  for (const color of palette) {
    const rgb = toRGB(color).map((v) => Math.round(v))
    const key = rgb.join(',')
    if (!seen.has(key)) {
      seen.add(key)
      paletteOut.push(Uint8ClampedArray.from([...rgb, 255]))
      paletteCS.push(Float32Array.from(color))
    }
  }
  return { paletteOut, paletteCS }
}

export function mapAndDither(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Vector[],
  config: DitheringConfig,
  colorSpace: ColorSpace
): Uint8ClampedArray {
  const { mode } = config
  const N = width * height

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

  const { paletteOut, paletteCS } = buildPalette(palette, (v) =>
    Array.from(toRGB(v))
  )

  const ditherFn = DITHER_MODES[mode]
  if (ditherFn) {
    return ditherFn(
      bufCS,
      width,
      height,
      paletteCS,
      paletteOut,
      config,
      distFn,
      mode
    )
  } else {
    console.warn(`Unsupported dithering mode: ${mode}`)
    return new Uint8ClampedArray(N * 4)
  }
}
