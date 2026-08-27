import {
  lookupColorIndex,
  type SourceColorMapping
} from '../quant/color-mapping-cache'
import { getBlueNoiseThresholdRGB } from './blue-noise-texture'

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

type PaletteBounds = {
  min: [number, number, number]
  max: [number, number, number]
}

interface DiffusionCorrectionOptions {
  enabled: boolean
  errorClamp: number
}

interface OrderedCorrectionOptions {
  enabled: boolean
}

/** Shared default so callers that omit `correction` reuse one frozen object. */
const DEFAULT_ORDERED_CORRECTION: OrderedCorrectionOptions = Object.freeze({
  enabled: true
})

/** Params for the error-diffusion ditherers (Floyd-Steinberg, Ostromoukhov). */
interface ErrorDiffusionDitherParams {
  bufCS: Float32Array
  width: number
  height: number
  palettes: LinePalettes
  distFn: DistanceFn
  intensity: number
  correction: DiffusionCorrectionOptions
}

/** Params for the blue-noise ditherer. */
interface BlueNoiseDitherParams {
  bufCS: Float32Array
  width: number
  height: number
  palettes: LinePalettes
  intensity: number
  distFn: DistanceFn
  correction?: OrderedCorrectionOptions
}

/**
 * The palette in force for one scanline, in both the working colorspace
 * (`paletteCS`, what distances are measured in) and RGBA output form
 * (`paletteOut`, what gets written). Deduplicated, never empty.
 */
export interface LinePalette {
  readonly paletteCS: Float32Array[]
  readonly paletteOut: Uint8ClampedArray[]
}

/**
 * Supplies the palette for scanline `y`.
 *
 * This is the one thing that separates the standard rendering path from raster
 * mode: the standard path passes a constant (`constantPalettes`), raster passes
 * a per-line lookup. Every ditherer asks per scanline, so both paths run the
 * same eleven implementations — before, raster had three hand-copied twins and
 * therefore only four modes.
 */
export type LinePalettes = (y: number) => LinePalette

/** A `LinePalettes` that answers with the same palette on every scanline. */
export function constantPalettes(palette: LinePalette): LinePalettes {
  return () => palette
}

function resolveDiffusionCorrectionOptions(
  config: DitheringConfig
): DiffusionCorrectionOptions {
  return {
    enabled: config.useDiffusionCorrection ?? true,
    errorClamp: 64
  }
}

function resolveOrderedCorrectionOptions(
  config: DitheringConfig
): OrderedCorrectionOptions {
  return {
    enabled: config.useOrderedCorrection ?? true
  }
}

function computePaletteBounds(paletteCS: Float32Array[]): PaletteBounds {
  const min: [number, number, number] = [255, 255, 255]
  const max: [number, number, number] = [0, 0, 0]

  for (const color of paletteCS) {
    if (color[0] < min[0]) min[0] = color[0]
    if (color[1] < min[1]) min[1] = color[1]
    if (color[2] < min[2]) min[2] = color[2]
    if (color[0] > max[0]) max[0] = color[0]
    if (color[1] > max[1]) max[1] = color[1]
    if (color[2] > max[2]) max[2] = color[2]
  }

  return { min, max }
}

function clampPixelToPaletteBounds(
  pixel: Float32Array,
  bounds: PaletteBounds,
  correction: DiffusionCorrectionOptions
): void {
  if (!correction.enabled) return

  pixel[0] = Math.max(bounds.min[0], Math.min(bounds.max[0], pixel[0]))
  pixel[1] = Math.max(bounds.min[1], Math.min(bounds.max[1], pixel[1]))
  pixel[2] = Math.max(bounds.min[2], Math.min(bounds.max[2], pixel[2]))
}

function clampErrorValue(
  value: number,
  correction: DiffusionCorrectionOptions
): number {
  if (!correction.enabled) return value
  return Math.max(
    -correction.errorClamp,
    Math.min(correction.errorClamp, value)
  )
}

function applyAtkinsonDither(
  bufCS: Float32Array,
  width: number,
  height: number,
  palettes: LinePalettes,
  config: DitheringConfig,
  distFn: DistanceFn
): Uint8ClampedArray {
  const { intensity } = config
  const out = new Uint8ClampedArray(width * height * 4)
  const pixel = new Float32Array(3)
  const errorBuf = new Float32Array(bufCS) // copy
  const correction = resolveDiffusionCorrectionOptions(config)

  // Atkinson diffusion offsets (relative to current pixel)
  const offsets = [
    [1, 0],
    [2, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [0, 2]
  ]

  const context: AtkinsonContext = {
    width,
    height,
    errorBuf,
    out,
    pixel,
    paletteCS: [],
    paletteOut: [],
    distFn,
    intensity,
    offsets,
    bounds: computePaletteBounds([]),
    correction
  }

  for (let y = 0; y < height; y++) {
    setLinePalette(context, palettes(y))
    for (let x = 0; x < width; x++) {
      processAtkinsonPixel(x, y, context)
    }
  }

  return out
}

/**
 * Points a diffusion context at the scanline's palette. The bounds are part of
 * the palette, not of the image, so they move with it.
 */
function setLinePalette(
  context: LinePaletteHolder,
  { paletteCS, paletteOut }: LinePalette
): void {
  context.paletteCS = paletteCS
  context.paletteOut = paletteOut
  context.bounds = computePaletteBounds(paletteCS)
}

/**
 * The palette state an error-diffusion context carries, swapped once per
 * scanline by {@link setLinePalette}.
 */
interface LinePaletteHolder {
  paletteCS: Float32Array[]
  paletteOut: Uint8ClampedArray[]
  bounds: PaletteBounds
}

/**
 * Context object for Atkinson dithering to reduce parameter count
 */
interface AtkinsonContext extends LinePaletteHolder {
  width: number
  height: number
  errorBuf: Float32Array
  out: Uint8ClampedArray
  pixel: Float32Array
  distFn: DistanceFn
  intensity: number
  offsets: number[][]
  correction: DiffusionCorrectionOptions
}

/**
 * Helper function to process a single pixel in Atkinson dithering
 * Reduces cognitive complexity by extracting pixel processing logic
 */
function processAtkinsonPixel(
  x: number,
  y: number,
  context: AtkinsonContext
): void {
  const { width, errorBuf, out, pixel, paletteCS, paletteOut, distFn } = context

  const idx = y * width + x
  const i3 = idx * 3
  const i4 = idx * 4

  // Get pixel with accumulated error
  pixel[0] = errorBuf[i3]
  pixel[1] = errorBuf[i3 + 1]
  pixel[2] = errorBuf[i3 + 2]
  clampPixelToPaletteBounds(pixel, context.bounds, context.correction)

  // Find nearest palette color
  const bestIndex = findClosestColorIndex(pixel, paletteCS, distFn)

  // Set output color
  const color = paletteOut[bestIndex]
  out[i4 + 0] = color[0]
  out[i4 + 1] = color[1]
  out[i4 + 2] = color[2]
  out[i4 + 3] = 255

  // Compute and distribute error
  distributeAtkinsonError(x, y, pixel, paletteCS[bestIndex], context)
}

/**
 * Helper function to distribute Atkinson dithering error
 * Reduces cognitive complexity by extracting error diffusion logic
 */
function distributeAtkinsonError(
  x: number,
  y: number,
  pixel: Float32Array,
  paletteColor: Float32Array,
  context: AtkinsonContext
): void {
  const { width, height, errorBuf, intensity, offsets } = context

  // Compute error
  const errR = clampErrorValue(
    (pixel[0] - paletteColor[0]) * intensity,
    context.correction
  )
  const errG = clampErrorValue(
    (pixel[1] - paletteColor[1]) * intensity,
    context.correction
  )
  const errB = clampErrorValue(
    (pixel[2] - paletteColor[2]) * intensity,
    context.correction
  )

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

export function applyYliluoma1Dither(
  bufCS: Float32Array,
  width: number,
  height: number,
  palettes: LinePalettes,
  config: DitheringConfig,
  distFn: DistanceFn
): Uint8ClampedArray {
  const { intensity } = config
  const { size, matrix } = BAYER_MATRICES.bayer8x8
  const out = new Uint8ClampedArray(width * height * 4)
  const pixel = new Float32Array(3)

  for (let y = 0; y < height; y++) {
    const { paletteCS, paletteOut } = palettes(y)
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
  palettes: LinePalettes,
  config: DitheringConfig,
  distFn: DistanceFn
): Uint8ClampedArray {
  const { intensity } = config
  const { size, matrix } = BAYER_MATRICES.bayer8x8
  const out = new Uint8ClampedArray(width * height * 4)
  const pixel = new Float32Array(3)
  const errorBuf = new Float32Array(width * height * 3)

  for (let y = 0; y < height; y++) {
    const { paletteCS, paletteOut } = palettes(y)
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const i3 = i * 3
      const o4 = i * 4

      // Clamp accumulated values to valid range to prevent overflow
      const r = Math.max(0, Math.min(255, bufCS[i3 + 0] + errorBuf[i3 + 0]))
      const g = Math.max(0, Math.min(255, bufCS[i3 + 1] + errorBuf[i3 + 1]))
      const b = Math.max(0, Math.min(255, bufCS[i3 + 2] + errorBuf[i3 + 2]))

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
  palettes: LinePalettes,
  bayerConfig: BayerConfig,
  distFn: DistanceFn
): Uint8ClampedArray {
  const { config, mode } = bayerConfig
  const { intensity } = config
  const out = new Uint8ClampedArray(width * height * 4)
  const { size, matrix } = BAYER_MATRICES[mode]
  const pixelCS = new Float32Array(3)
  const correction = resolveOrderedCorrectionOptions(config)

  for (let y = 0; y < height; y++) {
    const { paletteCS, paletteOut } = palettes(y)
    // Adaptive amplitude: scale by 1/sqrt(paletteSize) so larger palettes get
    // less noise. Per scanline, because raster palettes vary in size.
    const amplitude = correction.enabled
      ? intensity * (255 / Math.sqrt(paletteCS.length))
      : intensity * 255

    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const i3 = i * 3
      const i4 = i * 4

      const origR = bufCS[i3]
      const origG = bufCS[i3 + 1]
      const origB = bufCS[i3 + 2]

      // Skip perturbation if pixel already exactly matches a palette color
      if (correction.enabled) {
        pixelCS[0] = origR
        pixelCS[1] = origG
        pixelCS[2] = origB
        const exactIdx = findClosestColorIndex(pixelCS, paletteCS, distFn)
        if (distFn(pixelCS, paletteCS[exactIdx]) < 1e-4) {
          const rgb = paletteOut[exactIdx]
          out[i4 + 0] = rgb[0]
          out[i4 + 1] = rgb[1]
          out[i4 + 2] = rgb[2]
          out[i4 + 3] = 255
          continue
        }
      }

      const bayerVal = matrix[y % size][x % size]
      const threshold = (bayerVal / (size * size) - 0.5) * amplitude

      pixelCS[0] = Math.max(0, Math.min(255, origR + threshold))
      pixelCS[1] = Math.max(0, Math.min(255, origG + threshold))
      pixelCS[2] = Math.max(0, Math.min(255, origB + threshold))

      const bestIndex = findClosestColorIndex(pixelCS, paletteCS, distFn)

      const rgb = paletteOut[bestIndex]
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
  palettes: LinePalettes,
  distFn: DistanceFn,
  sourceColorMapping?: SourceColorMapping | null
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  const pixelCS = new Float32Array(3)

  // Vérifier si le mode distinct-mapping est actif
  const useDirectMapping = !!sourceColorMapping

  for (let y = 0; y < height; y++) {
    const { paletteCS, paletteOut } = palettes(y)

    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const i3 = i * 3
      pixelCS[0] = bufCS[i3]
      pixelCS[1] = bufCS[i3 + 1]
      pixelCS[2] = bufCS[i3 + 2]

      let bestI = 0

      // Si distinct-mapping est actif, utiliser le mapping direct
      if (useDirectMapping) {
        const r = Math.round(pixelCS[0])
        const g = Math.round(pixelCS[1])
        const b = Math.round(pixelCS[2])
        const mappedIdx = lookupColorIndex(sourceColorMapping, r, g, b)
        if (mappedIdx === undefined) {
          bestI = findClosestColorIndex(pixelCS, paletteCS, distFn)
        } else {
          bestI = mappedIdx
        }
      } else {
        bestI = findClosestColorIndex(pixelCS, paletteCS, distFn)
      }

      const outIdx = i * 4
      const color = paletteOut[bestI]
      out[outIdx + 0] = color[0]
      out[outIdx + 1] = color[1]
      out[outIdx + 2] = color[2]
      out[outIdx + 3] = 255
    }
  }

  return out
}

export function applyBlueNoiseDither({
  bufCS,
  width,
  height,
  palettes,
  intensity,
  distFn,
  correction = DEFAULT_ORDERED_CORRECTION
}: BlueNoiseDitherParams): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  const pixelCS = new Float32Array(3)

  for (let y = 0; y < height; y++) {
    const { paletteCS, paletteOut } = palettes(y)
    // Adaptive amplitude: scale by 1/sqrt(paletteSize) so larger palettes get
    // less noise. Per scanline, because raster palettes vary in size.
    const scale = correction.enabled
      ? intensity * (255 / Math.sqrt(paletteCS.length))
      : intensity * 255

    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const i3 = i * 3
      const i4 = i * 4

      const origR = bufCS[i3]
      const origG = bufCS[i3 + 1]
      const origB = bufCS[i3 + 2]

      // Skip perturbation if pixel already exactly matches a palette color
      if (correction.enabled) {
        pixelCS[0] = origR
        pixelCS[1] = origG
        pixelCS[2] = origB
        const exactIdx = findClosestColorIndex(pixelCS, paletteCS, distFn)
        if (distFn(pixelCS, paletteCS[exactIdx]) < 1e-4) {
          const rgb = paletteOut[exactIdx]
          out[i4 + 0] = rgb[0]
          out[i4 + 1] = rgb[1]
          out[i4 + 2] = rgb[2]
          out[i4 + 3] = 255
          continue
        }
      }

      // Get decorrelated blue noise thresholds for each RGB channel
      // This prevents pixels from clustering together
      const [tR, tG, tB] = getBlueNoiseThresholdRGB(x, y)

      // Apply per-channel dithering
      pixelCS[0] = Math.max(0, Math.min(255, origR + tR * scale))
      pixelCS[1] = Math.max(0, Math.min(255, origG + tG * scale))
      pixelCS[2] = Math.max(0, Math.min(255, origB + tB * scale))

      const bestIndex = findClosestColorIndex(pixelCS, paletteCS, distFn)

      const rgb = paletteOut[bestIndex]
      out[i4 + 0] = rgb[0]
      out[i4 + 1] = rgb[1]
      out[i4 + 2] = rgb[2]
      out[i4 + 3] = 255
    }
  }

  return out
}

// ============================================================================
// Ostromoukhov Error Diffusion
// ============================================================================

import { getOstromoukhovCoefficients } from './ostromoukhov-coefficients'

/**
 * Ostromoukhov error diffusion dithering
 *
 * Uses intensity-dependent coefficients to produce blue-noise spectra
 * and eliminate worm artifacts. Only diffuses to 3 neighbors (faster than F-S).
 *
 * Pattern (serpentine scan):
 *   Left-to-right:  X -> right, down-left, down
 *   Right-to-left:  X -> left, down-right, down
 */
export function applyOstromoukhovDither({
  bufCS,
  width,
  height,
  palettes,
  distFn,
  intensity,
  correction
}: ErrorDiffusionDitherParams): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  const pixelCS = new Float32Array(3)
  const errorBuf = new Float32Array(bufCS) // working copy
  const w3 = width * 3

  let leftToRight = true

  for (let y = 0; y < height; y++) {
    const { paletteCS, paletteOut } = palettes(y)
    const bounds = computePaletteBounds(paletteCS)
    const xStart = leftToRight ? 0 : width - 1
    const xEnd = leftToRight ? width : -1
    const xStep = leftToRight ? 1 : -1

    for (let x = xStart; leftToRight ? x < xEnd : x >= xEnd; x += xStep) {
      const idx3 = (y * width + x) * 3
      const idx4 = (y * width + x) * 4

      // Get current pixel value
      pixelCS[0] = errorBuf[idx3]
      pixelCS[1] = errorBuf[idx3 + 1]
      pixelCS[2] = errorBuf[idx3 + 2]
      clampPixelToPaletteBounds(pixelCS, bounds, correction)

      // Find nearest palette color
      const bestIndex = findClosestColorIndex(pixelCS, paletteCS, distFn)

      // Set output color
      const color = paletteOut[bestIndex]
      out[idx4 + 0] = color[0]
      out[idx4 + 1] = color[1]
      out[idx4 + 2] = color[2]
      out[idx4 + 3] = 255

      // Compute quantization error
      const palColor = paletteCS[bestIndex]
      const err0 = clampErrorValue(
        (pixelCS[0] - palColor[0]) * intensity,
        correction
      )
      const err1 = clampErrorValue(
        (pixelCS[1] - palColor[1]) * intensity,
        correction
      )
      const err2 = clampErrorValue(
        (pixelCS[2] - palColor[2]) * intensity,
        correction
      )

      // Get intensity-dependent coefficients
      // Use average luminance for coefficient lookup
      const avgIntensity = (pixelCS[0] + pixelCS[1] + pixelCS[2]) / 3
      const [rightCoef, downLeftCoef, downCoef] =
        getOstromoukhovCoefficients(avgIntensity)

      // Distribute error to neighbors (serpentine pattern)
      // Right (or left if going right-to-left)
      const rightX = x + xStep
      if (rightX >= 0 && rightX < width) {
        const rightIdx = idx3 + xStep * 3
        errorBuf[rightIdx + 0] += err0 * rightCoef
        errorBuf[rightIdx + 1] += err1 * rightCoef
        errorBuf[rightIdx + 2] += err2 * rightCoef
      }

      // Down-left (or down-right if going right-to-left)
      const downLeftX = x - xStep
      if (y + 1 < height && downLeftX >= 0 && downLeftX < width) {
        const downLeftIdx = idx3 - xStep * 3 + w3
        errorBuf[downLeftIdx + 0] += err0 * downLeftCoef
        errorBuf[downLeftIdx + 1] += err1 * downLeftCoef
        errorBuf[downLeftIdx + 2] += err2 * downLeftCoef
      }

      // Down
      if (y + 1 < height) {
        const downIdx = idx3 + w3
        errorBuf[downIdx + 0] += err0 * downCoef
        errorBuf[downIdx + 1] += err1 * downCoef
        errorBuf[downIdx + 2] += err2 * downCoef
      }
    }

    // Serpentine: alternate direction each line
    leftToRight = !leftToRight
  }

  return out
}

import { logger } from '@/core'
import {
  DISTANCE_METRICS_BY_COLORSPACE,
  type DistanceFn,
  getDistanceFn
} from '../metric/distance'
import { findClosestColorIndex } from '../metric/find-closest'
import type { DitheringConfig } from '../quant'
import type { ColorSpace, Vector } from '../type'

export function applyFloydSteinbergDither({
  bufCS,
  width,
  height,
  palettes,
  distFn,
  intensity,
  correction
}: ErrorDiffusionDitherParams): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  const pixelCS = new Float32Array(3)
  const w3 = width * 3

  // Floyd-Steinberg diffusion pattern: right 7/16, down-left 3/16, down 5/16, down-right 1/16
  const offsets = [3, -3 + w3, w3, 3 + w3]
  const weights = [7 / 16, 3 / 16, 5 / 16, 1 / 16].map((w) => w * intensity)

  const context: FloydSteinbergContext = {
    bufCS,
    width,
    height,
    out,
    pixelCS,
    w3,
    paletteCS: [],
    paletteOut: [],
    distFn,
    offsets,
    weights,
    bounds: computePaletteBounds([]),
    correction
  }

  for (let y = 0; y < height; y++) {
    setLinePalette(context, palettes(y))
    for (let x = 0; x < width; x++) {
      processFloydSteinbergPixel(x, y, context)
    }
  }

  return out
}

type BayerMode = 'bayer2x2' | 'bayer4x4' | 'bayer8x8' | 'halftone4x4'

/**
 * Context object for Bayer dithering to reduce parameter count
 */
interface BayerConfig {
  config: DitheringConfig
  mode: BayerMode
}

/**
 * Context object for Floyd-Steinberg dithering to reduce parameter count
 */
interface FloydSteinbergContext extends LinePaletteHolder {
  bufCS: Float32Array
  width: number
  height: number
  out: Uint8ClampedArray
  pixelCS: Float32Array
  w3: number
  distFn: DistanceFn
  offsets: number[]
  weights: number[]
  correction: DiffusionCorrectionOptions
}

/**
 * Helper function to process a single pixel in Floyd-Steinberg dithering
 * Reduces cognitive complexity by extracting pixel processing logic
 */
function processFloydSteinbergPixel(
  x: number,
  y: number,
  context: FloydSteinbergContext
): void {
  const { bufCS, width, out, pixelCS, paletteCS, paletteOut, distFn } = context

  const idx3 = (y * width + x) * 3

  // Get current pixel value
  pixelCS[0] = bufCS[idx3]
  pixelCS[1] = bufCS[idx3 + 1]
  pixelCS[2] = bufCS[idx3 + 2]
  clampPixelToPaletteBounds(pixelCS, context.bounds, context.correction)

  // Find nearest palette color
  const bestIndex = findClosestColorIndex(pixelCS, paletteCS, distFn)

  // Set output color
  const outIdx = (y * width + x) * 4
  const color = paletteOut[bestIndex]
  out[outIdx + 0] = color[0]
  out[outIdx + 1] = color[1]
  out[outIdx + 2] = color[2]
  out[outIdx + 3] = 255

  // Compute and distribute quantization error
  distributeFloydSteinbergError(x, y, pixelCS, paletteCS[bestIndex], context)
}

/**
 * Helper function to distribute Floyd-Steinberg dithering error
 * Reduces cognitive complexity by extracting error diffusion logic
 */
function distributeFloydSteinbergError(
  x: number,
  y: number,
  pixel: Float32Array,
  paletteColor: Float32Array,
  context: FloydSteinbergContext
): void {
  const { bufCS, width, height, offsets, weights } = context

  const idx3 = (y * width + x) * 3

  // Compute quantization error
  const err0 = clampErrorValue(pixel[0] - paletteColor[0], context.correction)
  const err1 = clampErrorValue(pixel[1] - paletteColor[1], context.correction)
  const err2 = clampErrorValue(pixel[2] - paletteColor[2], context.correction)

  // Distribute error to neighboring pixels
  for (let k = 0; k < 4; k++) {
    const tx = x + (k === 0 || k === 3 ? 1 : -1)
    const ty = y + (k > 1 ? 1 : 0)
    if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
      const t3 = idx3 + offsets[k]
      bufCS[t3 + 0] += err0 * weights[k]
      bufCS[t3 + 1] += err1 * weights[k]
      bufCS[t3 + 2] += err2 * weights[k]
    }
  }
}

type DitherFn = (
  bufCS: Float32Array,
  width: number,
  height: number,
  palettes: LinePalettes,
  config: DitheringConfig,
  distFn: DistanceFn
) => Uint8ClampedArray

const DITHER_MODES: Record<string, DitherFn> = {
  none: (bufCS, width, height, palettes, _config, distFn) =>
    applyNoDither(bufCS, width, height, palettes, distFn),

  floydSteinberg: (bufCS, width, height, palettes, config, distFn) =>
    applyFloydSteinbergDither({
      bufCS,
      width,
      height,
      palettes,
      distFn,
      intensity: config.intensity,
      correction: resolveDiffusionCorrectionOptions(config)
    }),

  bayer2x2: (bufCS, width, height, palettes, config, distFn) =>
    applyBayerDither(
      bufCS,
      width,
      height,
      palettes,
      { config, mode: 'bayer2x2' },
      distFn
    ),

  bayer4x4: (bufCS, width, height, palettes, config, distFn) =>
    applyBayerDither(
      bufCS,
      width,
      height,
      palettes,
      { config, mode: 'bayer4x4' },
      distFn
    ),

  bayer8x8: (bufCS, width, height, palettes, config, distFn) =>
    applyBayerDither(
      bufCS,
      width,
      height,
      palettes,
      { config, mode: 'bayer8x8' },
      distFn
    ),

  ylioluma1: (bufCS, width, height, palettes, config, distFn) =>
    applyYliluoma1Dither(bufCS, width, height, palettes, config, distFn),

  ylioluma2: (bufCS, width, height, palettes, config, distFn) =>
    applyYliluoma2Dither(bufCS, width, height, palettes, config, distFn),

  atkinson: (bufCS, width, height, palettes, config, distFn) =>
    applyAtkinsonDither(bufCS, width, height, palettes, config, distFn),

  halftone4x4: (bufCS, width, height, palettes, config, distFn) =>
    applyBayerDither(
      bufCS,
      width,
      height,
      palettes,
      { config, mode: 'halftone4x4' },
      distFn
    ),

  blueNoise: (bufCS, width, height, palettes, config, distFn) =>
    applyBlueNoiseDither({
      bufCS,
      width,
      height,
      palettes,
      intensity: config.intensity,
      distFn,
      correction: resolveOrderedCorrectionOptions(config)
    }),

  ostromoukhov: (bufCS, width, height, palettes, config, distFn) =>
    applyOstromoukhovDither({
      bufCS,
      width,
      height,
      palettes,
      distFn,
      intensity: config.intensity,
      correction: resolveDiffusionCorrectionOptions(config)
    })
}

/**
 * Builds one scanline's palette: deduplicated on the rounded RGB triple, and
 * never empty (an empty palette falls back to black, so the ditherers can
 * index `paletteOut` unconditionally).
 */
function buildPalette(palette: Vector[]): LinePalette {
  const seen = new Set<string>()
  const paletteOut: Uint8ClampedArray[] = []
  const paletteCS: Float32Array[] = []

  for (const color of palette) {
    const rgb = Array.from(color).map((v) => Math.round(v))
    const key = rgb.join(',')
    if (!seen.has(key)) {
      seen.add(key)
      paletteOut.push(Uint8ClampedArray.from([...rgb, 255]))
      paletteCS.push(Float32Array.from(color))
    }
  }

  // Ensure we have at least one color (fallback to black if palette is empty)
  if (paletteOut.length === 0) {
    paletteOut.push(Uint8ClampedArray.from([0, 0, 0, 255]))
    paletteCS.push(Float32Array.from([0, 0, 0]))
  }

  return { paletteOut, paletteCS }
}

/** Drops the alpha channel: the ditherers work on packed RGB triples. */
function toWorkingBuffer(
  srcData: Uint8ClampedArray,
  pixelCount: number
): Float32Array {
  const bufCS = new Float32Array(pixelCount * 3)
  for (let i = 0, j = 0; i < srcData.length; i += 4, j += 3) {
    bufCS[j] = srcData[i]
    bufCS[j + 1] = srcData[i + 1]
    bufCS[j + 2] = srcData[i + 2]
  }
  return bufCS
}

export function mapAndDither(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Vector[],
  config: DitheringConfig,
  colorSpace: ColorSpace,
  sourceColorMapping?: SourceColorMapping | null
): Uint8ClampedArray {
  const { mode } = config
  const N = width * height

  const distFn = getDistanceFn(
    colorSpace,
    DISTANCE_METRICS_BY_COLORSPACE[colorSpace][0]
  )

  const bufCS = toWorkingBuffer(srcData, N)

  const palettes = constantPalettes(buildPalette(palette))

  // Si distinct-mapping est actif, forcer applyNoDither (pas de dithering)
  // pour garantir le mapping 1:1 des couleurs source vers palette
  if (sourceColorMapping) {
    return applyNoDither(
      bufCS,
      width,
      height,
      palettes,
      distFn,
      sourceColorMapping
    )
  }

  return runDither(mode, bufCS, width, height, palettes, config, distFn)
}

/**
 * Looks the mode up in the one registry and runs it. Unknown modes produce a
 * transparent image rather than a throw, as they always have.
 */
function runDither(
  mode: DitheringConfig['mode'],
  bufCS: Float32Array,
  width: number,
  height: number,
  palettes: LinePalettes,
  config: DitheringConfig,
  distFn: DistanceFn
): Uint8ClampedArray {
  const ditherFn = DITHER_MODES[mode]
  if (!ditherFn) {
    logger.warn(`Unsupported dithering mode: ${mode}`)
    return new Uint8ClampedArray(width * height * 4)
  }
  return ditherFn(bufCS, width, height, palettes, config, distFn)
}

/**
 * Apply dithering with dynamic per-line palettes (for raster optimization).
 *
 * Same eleven modes as {@link mapAndDither} — the only difference is that the
 * palette is looked up per scanline instead of once. Error-diffusion modes are
 * included: the residual is diffused across line boundaries as usual, it is
 * simply quantized against whichever palette the receiving line carries.
 *
 * @param srcData - Source image data (RGBA)
 * @param width - Image width
 * @param height - Image height
 * @param getPaletteForLine - Returns the palette in force at line `y`
 * @param config - Dithering configuration
 * @param colorSpace - Color space for distance calculations
 * @returns RGBA image data after dithering
 */
export function mapAndDitherWithDynamicPalette(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  getPaletteForLine: (y: number) => Vector[],
  config: DitheringConfig,
  colorSpace: ColorSpace
): Uint8ClampedArray {
  const distFn = getDistanceFn(
    colorSpace,
    DISTANCE_METRICS_BY_COLORSPACE[colorSpace][0]
  )

  return runDither(
    config.mode,
    toWorkingBuffer(srcData, width * height),
    width,
    height,
    perLinePalettes(getPaletteForLine),
    config,
    distFn
  )
}

/**
 * A `LinePalettes` backed by a per-line lookup, memoized so a ditherer that
 * asks twice for the same scanline does not rebuild it.
 */
function perLinePalettes(
  getPaletteForLine: (y: number) => Vector[]
): LinePalettes {
  const cache = new Map<number, LinePalette>()
  return (y) => {
    const cached = cache.get(y)
    if (cached) return cached
    const built = buildPalette(getPaletteForLine(y))
    cache.set(y, built)
    return built
  }
}
