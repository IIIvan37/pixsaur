// Interfaces
export type {
  IImageProcessor,
  IPaletteProcessor,
  IImageAdjustmentConfig,
  IQuantizationConfig,
  IDitheringConfig
} from './interfaces/image-processor'

// Factory
export { ImageProcessorFactory, imageProcessorFactory } from './factory/processor-factory'

// Adaptateurs
export { CPUImageProcessor } from './adapters/cpu-image-processor'
export { WebGLImageProcessor } from './adapters/webgl-image-processor'
export { CPUPaletteProcessor } from './adapters/cpu-palette-processor'
export { WebGLPaletteProcessor } from './adapters/webgl-palette-processor'