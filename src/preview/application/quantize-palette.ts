/**
 * `quantizePalette` use-case — pure palette quantization for the preview
 * pipeline (clean-archi strangler-fig).
 *
 * Replaces the inlined orchestration of `reducedPaletteRawAtom` /
 * `reducedPaletteRgbAtom` in `src/app/store/preview/pipeline/quantization.ts`.
 * The impure quantizer arrives through the {@link PaletteQuantizer} port; every
 * other step is pure domain logic (`@/domain/cpc`, `@/palettes`).
 *
 * Living registry: see `./README.md`.
 */

import type { PaletteStrategy } from '@/app/store/config/types'
import {
  quantizeArrayForHardware,
  quantizeColorForHardware,
  truncatePalette
} from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { CPCHardware } from '@/libs/types'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
import type { PaletteQuantizer } from './ports'

export interface QuantizePaletteInput {
  /** RGBA source buffer the palette is sampled from. */
  buf: Uint8ClampedArray
  /** Source image dimensions (full `ImageData` or just `{ width, height }`). */
  sourceImage: ImageData | { width: number; height: number }
  /** User-locked palette colors (pre-hardware-quantization). */
  lockedVecs: Vector[]
  cpcHardware: CPCHardware
  /** Effective CPC mode config — only `nColors` is consumed. */
  modeConfig: { nColors: number }
  /** Locked-but-empty slots, reserved out of the final color budget. */
  lockedEmptyCount: number
  paletteStrategy: PaletteStrategy
  autoDistinctMapping: boolean
  colorDiversity: number
}

export interface QuantizePaletteDeps {
  quantizer: PaletteQuantizer
}

export type QuantizePaletteResult =
  | { ok: true; rawPalette: Vector[]; rgbPalette: Vector[] }
  | { ok: false; error: string }

/**
 * Produces both the raw quantized palette (RGB, not yet hardware-quantized) and
 * the display-ready RGB palette (hardware-quantized + truncated to the
 * effective color budget).
 */
export async function quantizePalette(
  input: QuantizePaletteInput,
  deps: QuantizePaletteDeps
): Promise<QuantizePaletteResult> {
  const {
    buf,
    sourceImage,
    lockedVecs,
    cpcHardware,
    modeConfig,
    lockedEmptyCount,
    paletteStrategy,
    autoDistinctMapping,
    colorDiversity
  } = input

  const basePalette = getPaletteForHardware(cpcHardware)
  // Always request the mode's max colors for palette stability; the RGB palette
  // is truncated afterwards to exclude extra colors.
  const targetColors = modeConfig.nColors

  // Quantify locked colors to the target hardware BEFORE handing them to the
  // quantizer, so it preselects on the same grid the display uses.
  const quantifiedLockedVecs = lockedVecs.map((color) =>
    quantizeColorForHardware(color, cpcHardware)
  )

  const rawPalette = await deps.quantizer.quantizePalette(
    buf,
    sourceImage,
    targetColors,
    basePalette,
    quantifiedLockedVecs,
    paletteStrategy,
    { autoDistinctMapping, colorDiversity }
  )

  // RGB palette: hardware-quantify a copy (Classic: 27 colors, Plus: 4096),
  // then truncate to the budget left after locked-empty slots.
  const rgbPalette = rawPalette.map((color) => [...color] as Vector)
  quantizeArrayForHardware(rgbPalette, cpcHardware)
  const effectiveMaxColors = modeConfig.nColors - lockedEmptyCount

  return {
    ok: true,
    rawPalette,
    rgbPalette: truncatePalette(rgbPalette, effectiveMaxColors)
  }
}
