import type { ImageProcessor, ProcessorFactory } from './interfaces'
import { CpuImageProcessor } from './adapters/cpu-processor'
import { WebGLAdapterProcessor } from './adapters/webgl-processor'
import { detectWebGLCapabilities, isWebGLRecommended, getWebGLSummary } from './webgl-detection'
import { adapterLogger } from '@/utils/logger'

/**
 * Factory pour créer les processors d'image
 * Gère la sélection automatique CPU/WebGL avec fallback intelligent
 */
export class ImageProcessorFactory implements ProcessorFactory {
  private static instance: ImageProcessorFactory | null = null
  
  // Cache pour éviter de recréer les processeurs
  private cpuProcessor: CpuImageProcessor | null = null
  private webglProcessor: WebGLAdapterProcessor | null = null
  private webglCapabilities: ReturnType<typeof detectWebGLCapabilities> | null = null

  static getInstance(): ImageProcessorFactory {
    ImageProcessorFactory.instance ??= new ImageProcessorFactory()
    return ImageProcessorFactory.instance
  }

  constructor() {
    // Évaluer les capacités WebGL au démarrage
    this.webglCapabilities = detectWebGLCapabilities()
    
    if (this.webglCapabilities.isAvailable) {
      adapterLogger.info(`🎮 [FACTORY] WebGL detected: ${getWebGLSummary()}`)
    } else {
      adapterLogger.info('💻 [FACTORY] WebGL not available, will use CPU only')
    }
  }

  createBestProcessor(): ImageProcessor {
    return adapterLogger.timeSync('🏭 [FACTORY] Best Processor Selection', () => {
      // Sélection intelligente basée sur les capacités WebGL
      if (this.isWebGlAvailable() && isWebGLRecommended()) {
        adapterLogger.info('🏭 [FACTORY] Creating best processor (WebGL recommended)')
        const webglProcessor = this.createWebGlProcessor()
        if (webglProcessor) {
          return webglProcessor
        }
        // Fallback vers CPU si WebGL échoue
        adapterLogger.warn('⚠️ [FACTORY] WebGL creation failed, falling back to CPU')
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

  createWebGlProcessor(): ImageProcessor | null {
    if (!this.isWebGlAvailable()) {
      adapterLogger.warn('🚨 [FACTORY] Cannot create WebGL processor: WebGL not available')
      return null
    }

    if (this.webglProcessor) {
      adapterLogger.info('♻️ [FACTORY] Reusing cached WebGL processor instance')
      return this.webglProcessor
    }
    
    return adapterLogger.timeSync('🎮 [FACTORY] WebGL Processor Creation', () => {
      try {
        adapterLogger.info('🎮 [FACTORY] Creating new WebGL processor instance')
        this.webglProcessor = new WebGLAdapterProcessor()
        
        if (this.webglProcessor.isAvailable) {
          adapterLogger.info('✅ [FACTORY] WebGL processor instance created and cached')
          return this.webglProcessor
        } else {
          adapterLogger.warn('⚠️ [FACTORY] WebGL processor created but not available')
          this.webglProcessor = null
          return null
        }
      } catch (error) {
        adapterLogger.error('🚨 [FACTORY] WebGL processor creation failed:', error)
        this.webglProcessor = null
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
    } else {
      adapterLogger.debug('💭 [FACTORY] No cached processors to clear')
    }
  }
}

// Instance globale pour faciliter l'utilisation
export const processorFactory = ImageProcessorFactory.getInstance()