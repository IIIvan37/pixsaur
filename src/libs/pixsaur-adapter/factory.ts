import { adapterLogger } from '@/utils/logger'
import { CpuImageProcessor } from './adapters/cpu-processor'
import { ReGLProcessor } from './adapters/regl-processor'
import type { ImageProcessor, ProcessorFactory } from './interfaces'
import { detectWebGLCapabilities, getWebGLSummary } from './webgl-detection'
import type * as REGL from 'regl'

export type ProcessorType = 'auto' | 'cpu' | 'gpu'

/**
 * Factory pour créer les processors d'image
 * Utilise l'architecture adaptateur avec quantizers CPU/ReGL
 */
export class ImageProcessorFactory implements ProcessorFactory {
  private static instance: ImageProcessorFactory | null = null

  // Cache pour éviter de recréer les processeurs
  private cpuProcessor: CpuImageProcessor | null = null
  private reglProcessor: ReGLProcessor | null = null
  private webglCapabilities: ReturnType<typeof detectWebGLCapabilities> | null =
    null

  static getInstance(): ImageProcessorFactory {
    ImageProcessorFactory.instance ??= new ImageProcessorFactory()
    return ImageProcessorFactory.instance
  }

  constructor() {
    // Évaluer les capacités WebGL au démarrage
    this.webglCapabilities = detectWebGLCapabilities()

    if (this.webglCapabilities.isAvailable) {
      adapterLogger.info(
        `🎮 [FACTORY] WebGL detected, ReGL processor available: ${getWebGLSummary()}`
      )
    } else {
      adapterLogger.info('💻 [FACTORY] WebGL not available, will use CPU only')
    }
  }

  async createBestProcessor(processorType: ProcessorType = 'auto'): Promise<ImageProcessor> {
    adapterLogger.info(`🏭 [FACTORY] createBestProcessor called with type: ${processorType}`)
    return adapterLogger.timeSync(
      '🏭 [FACTORY] Best Processor Selection',
      async () => {
        // Force CPU if requested
        if (processorType === 'cpu') {
          adapterLogger.info('🏭 [FACTORY] Creating CPU processor (forced by user)')
          return this.createCpuProcessor()
        }

        // Force GPU if requested
        if (processorType === 'gpu') {
          adapterLogger.info('🏭 [FACTORY] Creating GPU processor (forced by user)')
          
          if (!this.isWebGlAvailable()) {
            adapterLogger.warn('⚠️ [FACTORY] GPU requested but WebGL not available, falling back to CPU')
            return this.createCpuProcessor()
          }

          const reglProcessor = await this.createReGlProcessor()
          if (reglProcessor) {
            return reglProcessor
          }

          adapterLogger.warn('⚠️ [FACTORY] GPU requested but ReGL creation failed, falling back to CPU')
          return this.createCpuProcessor()
        }

        // Auto mode - try ReGL first if available
        if (this.isWebGlAvailable()) {
          adapterLogger.info(
            '🏭 [FACTORY] Creating best processor (trying ReGL first)'
          )

          const reglProcessor = await this.createReGlProcessor()
          if (reglProcessor) {
            return reglProcessor
          }

          adapterLogger.warn(
            '⚠️ [FACTORY] ReGL creation failed, falling back to CPU'
          )
        } else {
          adapterLogger.info(
            '🏭 [FACTORY] Creating best processor (CPU selected - no WebGL)'
          )
        }

        // Fallback CPU processor
        return this.createCpuProcessor()
      }
    )
  }

  createCpuProcessor(): ImageProcessor {
    if (this.cpuProcessor) {
      adapterLogger.info('♻️ [FACTORY] Reusing cached CPU processor instance')
      return this.cpuProcessor
    }

    return adapterLogger.timeSync('🏗️ [FACTORY] CPU Processor Creation', () => {
      adapterLogger.info('🖥️ [FACTORY] Creating new CPU processor instance')
      this.cpuProcessor = new CpuImageProcessor()
      adapterLogger.info(
        '✅ [FACTORY] CPU processor instance created and cached'
      )
      return this.cpuProcessor
    })
  }

  async createReGlProcessor(): Promise<ImageProcessor | null> {
    if (!this.isWebGlAvailable()) {
      adapterLogger.warn(
        '🚨 [FACTORY] Cannot create ReGL processor: WebGL not available'
      )
      return null
    }

    if (this.reglProcessor) {
      adapterLogger.info('♻️ [FACTORY] Reusing cached ReGL processor instance')
      return this.reglProcessor
    }

    return adapterLogger.timeSync(
      '🎮 [FACTORY] ReGL Processor Creation',
      async () => {
        try {
          adapterLogger.info(
            '🎮 [FACTORY] Creating new ReGL processor instance'
          )

          // Créer l'instance ReGL d'abord
          const reglInstance = await this.createReGLInstance()
          if (!reglInstance) {
            adapterLogger.warn('⚠️ [FACTORY] Failed to create ReGL instance')
            return null
          }

          // Créer le ReGLProcessor avec l'instance ReGL
          this.reglProcessor = new ReGLProcessor(reglInstance)

          if (this.reglProcessor.isAvailable) {
            adapterLogger.info(
              '✅ [FACTORY] ReGL processor instance created and cached'
            )
            return this.reglProcessor
          } else {
            adapterLogger.warn(
              '⚠️ [FACTORY] ReGL processor created but not available'
            )
            this.reglProcessor = null
            return null
          }
        } catch (error) {
          adapterLogger.error(
            '🚨 [FACTORY] ReGL processor creation failed:',
            error
          )
          this.reglProcessor = null
          return null
        }
      }
    )
  }

  isWebGlAvailable(): boolean {
    this.webglCapabilities ??= detectWebGLCapabilities()

    const available = this.webglCapabilities.isAvailable
    adapterLogger.debug(`🔍 [FACTORY] WebGL availability check: ${available}`)
    return available
  }

  private async createReGLInstance(): Promise<REGL.Regl | null> {
    try {
      adapterLogger.debug('🎨 [FACTORY] Creating ReGL instance...')
      
      const { default: createREGL } = await import('regl')
      const regl = createREGL()
      
      adapterLogger.info('✅ [FACTORY] ReGL instance created successfully')
      return regl
    } catch (error) {
      adapterLogger.error('❌ [FACTORY] Failed to create ReGL instance:', error)
      return null
    }
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
  }
}

// Instance globale pour faciliter l'utilisation
export const processorFactory = ImageProcessorFactory.getInstance()
