/**
 * Serializable snapshot of the user's working session.
 *
 * Only captures the *user-input* leaf atoms that aren't already persisted on
 * their own via `atomWithStorage` (hardware, locale, palette slots, raster
 * tuning, EGX/Mode-R toggles, DSK workspace). Everything here is plain JSON so
 * the whole thing round-trips through `localStorage`.
 */

import type { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'
import type { DitheringConfig } from '@/libs/pixsaur-color/src'
import type { ColorSpace } from '@/libs/pixsaur-color/src/type'
import type { defaultAdjustments } from '../config/adjustments'
import type { EGXPreviewMode } from '../config/egx'
import type { ModeRPreviewMode } from '../config/mode-r'
import type { ResizeMode } from '../config/resize-types'
import type {
  CustomDimensions,
  DimensionPreset,
  PaletteStrategy,
  PixelMode,
  ProcessorType,
  ResampleStrategy
} from '../config/types'

export type Adjustments = typeof defaultAdjustments

/** Bump when the snapshot shape changes incompatibly. */
export const SESSION_VERSION = 1

export const SESSION_STORAGE_KEY = 'pixsaur-session'

export interface SessionSnapshot {
  readonly version: number
  /** Source image as a data URL (already how the decoded image stores its src). */
  readonly image: { readonly src: string } | null
  readonly canvasWidth: number | null
  readonly selection: Selection | null
  readonly adjustments: Adjustments
  readonly activePresetId: string | null
  readonly pixelMode: PixelMode
  readonly dimensionPreset: DimensionPreset
  readonly customDimensions: CustomDimensions
  readonly colorSpace: ColorSpace
  readonly dithering: DitheringConfig
  readonly smoothing: boolean
  readonly horizontalSmoothing: boolean
  readonly processorType: ProcessorType
  readonly paletteStrategy: PaletteStrategy
  readonly autoDistinctMapping: boolean
  readonly colorDiversity: number
  readonly resampleStrategy: ResampleStrategy
  readonly resizeMode: ResizeMode
  readonly centerImage: boolean
  readonly egxPreviewMode: EGXPreviewMode
  readonly egxOverscan: boolean
  readonly modeRPreviewMode: ModeRPreviewMode
  readonly rasterEnabled: boolean
  /** Manual pixel edits, serialized as ["x,y", inkIndex] entries. */
  readonly manualEdits: ReadonlyArray<readonly [string, number]>
}
