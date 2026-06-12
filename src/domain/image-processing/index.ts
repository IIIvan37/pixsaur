/**
 * Image Processing Domain Module
 *
 * Pure image manipulation functions without side effects.
 */

export {
  isProcessedImage,
  isSourceImage,
  type ProcessedImage,
  type SourceImage
} from './image-types'
export {
  type PositioningOptions,
  positionImage,
  positionImageForAutoMode,
  type TargetDimensions
} from './positioning'
export type { ResampleStrategy } from './resample-strategy'
