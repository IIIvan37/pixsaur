import type { ImageProcessor, ProcessorFactory } from './interfaces'
import { CpuImageProcessor } from './adapters/cpu-processor'
import { adapterLogger } from '@/utils/logger'

/**
 * Factory pour créer les processors d'image
 * Gère la sélection automatique CPU/WebGL avec fallback
 */
export class ImageProcessorFactory implements ProcessorFactory {
  private static instance: ImageProcessorFactory | null = null
  
  // Cache pour éviter de recréer les processeurs
  private cpuProcessor: CpuImageProcessor | null = null

  static getInstance(): ImageProcessorFactory {
    ImageProcessorFactory.instance ??= new ImageProcessorFactory()
    return ImageProcessorFactory.instance
  }

  createBestProcessor(): ImageProcessor {
    // Pour l'instant, utilise uniquement CPU
    // WebGL sera ajouté dans la prochaine étape
    adapterLogger.info('🏭 [FACTORY] Creating best processor (CPU only for now)')
    return this.createCpuProcessor()
  }

  createCpuProcessor(): ImageProcessor {
    if (this.cpuProcessor) {
      adapterLogger.info('♻️ [FACTORY] Reusing cached CPU processor instance')
      return this.cpuProcessor
    }
    
    return adapterLogger.timeSync('🏗️ [FACTORY] CPU Processor Creation', () => {
      adapterLogger.info('🖥️ [FACTORY] Creating new CPU processor instance')
      this.cpuProcessor = new CpuImageProcessor()
      adapterLogger.info('✅ [FACTORY] CPU processor instance created and cached')
      return this.cpuProcessor
    })
  }

  createWebGlProcessor(): ImageProcessor | null {
    // WebGL processor sera implémenté dans la prochaine étape
    adapterLogger.warn('⚠️ [FACTORY] WebGL processor not implemented yet - returning null')
    return null
  }

  isWebGlAvailable(): boolean {
    // Vérification WebGL sera ajoutée dans la prochaine étape
    adapterLogger.debug('🔍 [FACTORY] WebGL availability check (not implemented yet)')
    return false
  }
  
  /**
   * Nettoie le cache des processeurs
   */
  clearCache(): void {
    adapterLogger.info('🧹 [FACTORY] Clearing processor cache...')
    if (this.cpuProcessor) {
      this.cpuProcessor.dispose()
      this.cpuProcessor = null
      adapterLogger.info('🗑️ [FACTORY] CPU processor cache cleared')
    } else {
      adapterLogger.debug('💭 [FACTORY] No cached processors to clear')
    }
  }
}

// Instance globale pour faciliter l'utilisation
export const processorFactory = ImageProcessorFactory.getInstance()