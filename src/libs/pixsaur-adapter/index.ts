export type { ImageProcessor, ProcessorFactory, AdjustmentConfig } from './interfaces'
export { CpuImageProcessor } from './adapters/cpu-processor'
export { ImageProcessorFactory, processorFactory } from './factory'