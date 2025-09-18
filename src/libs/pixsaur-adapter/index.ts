export type {
  AdjustmentConfig,
  ImageProcessor,
  ProcessorFactory
} from './interfaces'

// Re-export du factory centralisé
export { processorFactory } from '@/app/store/adapters/processors'
