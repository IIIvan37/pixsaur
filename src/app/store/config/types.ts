/**
 * Shim de ré-exports — l'organisation du store est gelée pendant le refactor
 * clean-archi, donc les nombreux imports `@/app/store/config/types` continuent
 * de fonctionner. Les définitions canoniques vivent désormais dans :
 * - @/domain/cpc (mode-config) pour les modes/dimensions CPC
 * - @/domain/image-processing pour ResampleStrategy
 * - @/libs/pixsaur-color (strategy-names) pour PaletteStrategy
 * Ne pas re-déclarer ces types ici (voir docs/refactor/ADR-001-file-layout.md).
 */

export {
  buildCpcModeKey,
  buildCustomModeConfig,
  CPC_MODE_CONFIG,
  type CpcModeConfig,
  type CpcModeKey,
  type CustomDimensions,
  type DimensionPreset,
  type PixelMode,
  parseCpcModeKey
} from '@/domain/cpc'
export type { ResampleStrategy } from '@/domain/image-processing'
export type { PaletteStrategy } from '@/libs/pixsaur-color/src/quant/strategy-names'

// Processor types for image processing
export type ProcessorType = 'auto' | 'cpu' | 'gpu'

export type AdjustementKey =
  | 'red'
  | 'green'
  | 'blue'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'hue'
  | 'vibrance'
  | 'temperature'
  | 'tint'
  | 'gamma'
  | 'exposure'
  | 'highlights'
  | 'shadows'
  | 'posterization'
  | 'median'
  | 'sharpen'
  | 'blur'
  | 'edges'
  | 'chromaKeyEnabled'
  | 'chromaKeyTolerance'
