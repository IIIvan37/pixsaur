import type { ImageProcessor, ProcessorFactory } from './interfaces'
import { CpuImageProcessor } from './adapters/cpu-processor'
import { ReGLProcessor } from './adapters/regl-processor'
import { detectWebGLCapabilities, isWebGLRecommended, getWebGLSummary } from './webgl-detection'
import { adapterLogger } from '@/utils/logger'

/**
 * Factory pour créer les processors d'image
 * Gère la sélection automatique CPU/ReGL avec fallback intelligent
 */
export class ImageProcessorFactory implements ProcessorFactory {
  private static instance: ImageProcessorFactory | null = null
  
  // Cache pour éviter de recréer les processeurs
  private cpuProcessor: CpuImageProcessor | null = null
  private reglProcessor: ReGLProcessor | null = null
  private webglCapabilities: ReturnType<typeof detectWebGLCapabilities> | null = null

  static getInstance(): ImageProcessorFactory {
    ImageProcessorFactory.instance ??= new ImageProcessorFactory()
    return ImageProcessorFactory.instance
  }

  constructor() {
    // Évaluer les capacités WebGL au démarrage
    this.webglCapabilities = detectWebGLCapabilities()
    
    if (this.webglCapabilities.isAvailable) {
      adapterLogger.info(`🎮 [FACTORY] WebGL detected, ReGL processor available: ${getWebGLSummary()}`)
    } else {
      adapterLogger.info('💻 [FACTORY] WebGL not available, will use CPU only')
    }
  }

  createBestProcessor(): ImageProcessor {
    return adapterLogger.timeSync('🏭 [FACTORY] Best Processor Selection', () => {
      // Sélection intelligente basée sur les capacités WebGL pour ReGL
      if (this.isWebGlAvailable() && isWebGLRecommended()) {
        adapterLogger.info('🏭 [FACTORY] Creating best processor (ReGL recommended)')
        const reglProcessor = this.createReGlProcessor()
        if (reglProcessor) {
          return reglProcessor
        }
        // Fallback vers CPU si ReGL échoue
        adapterLogger.warn('⚠️ [FACTORY] ReGL creation failed, falling back to CPU')
      } else {
        adapterLogger.info('🏭 [FACTORY] Creating best processor (CPU selected)')
      }
      
      return this.createCpuProcessor()
    })
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

  createReGlProcessor(): ImageProcessor | null {
    if (!this.isWebGlAvailable()) {
      adapterLogger.warn('🚨 [FACTORY] Cannot create ReGL processor: WebGL not available')
      return null
    }

    if (this.reglProcessor) {
      adapterLogger.info('♻️ [FACTORY] Reusing cached ReGL processor instance')
      return this.reglProcessor
    }
    
    return adapterLogger.timeSync('🎮 [FACTORY] ReGL Processor Creation', () => {
      try {
        adapterLogger.info('🎮 [FACTORY] Creating new ReGL processor instance')
        this.reglProcessor = new ReGLProcessor()
        
        if (this.reglProcessor.isAvailable) {
          adapterLogger.info('✅ [FACTORY] ReGL processor instance created and cached')
          return this.reglProcessor
        } else {
          adapterLogger.warn('⚠️ [FACTORY] ReGL processor created but not available')
          this.reglProcessor = null
          return null
        }
      } catch (error) {
        adapterLogger.error('🚨 [FACTORY] ReGL processor creation failed:', error)
        this.reglProcessor = null
        return null
      }
    })
  }

  isWebGlAvailable(): boolean {
    this.webglCapabilities ??= detectWebGLCapabilities()
    
    const available = this.webglCapabilities.isAvailable
    adapterLogger.debug(`🔍 [FACTORY] WebGL availability check: ${available}`)
    return available
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
    }
    if (this.reglProcessor) {
      this.reglProcessor.dispose()
      this.reglProcessor = null
      adapterLogger.info('🗑️ [FACTORY] ReGL processor cache cleared')
    }
    if (!this.cpuProcessor && !this.reglProcessor) {
      adapterLogger.debug('💭 [FACTORY] No cached processors to clear')
    }
  }
}

// Instance globale pour faciliter l'utilisation
export const processorFactory = ImageProcessorFactory.getInstance()