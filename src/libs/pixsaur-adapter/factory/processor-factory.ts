import type { IImageProcessor, IPaletteProcessor } from '../interfaces/image-processor'
import { adapterLogger } from '@/utils/logger'

// Factory pour créer automatiquement l'adaptateur approprié
export class ImageProcessorFactory {
  private static instance: ImageProcessorFactory | null = null
  
  static getInstance(): ImageProcessorFactory {
    ImageProcessorFactory.instance ??= new ImageProcessorFactory()
    return ImageProcessorFactory.instance
  }
  
  // Détection des capacités WebGL2
  isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2')
      return !!gl && this.checkWebGLCapabilities(gl)
    } catch {
      return false
    }
  }
  
  private checkWebGLCapabilities(_gl: WebGL2RenderingContext): boolean {
    // Vérifications des capacités requises pour nos shaders
    const requiredExtensions: string[] = [
      // Extensions nécessaires si besoin
      // 'EXT_color_buffer_float' // exemple
    ]
    
    // Pour l'instant, pas d'extensions requises
    if (requiredExtensions.length > 0) {
      for (const ext of requiredExtensions) {
        if (!_gl.getExtension(ext)) {
          adapterLogger.warn(`WebGL extension ${ext} not supported`)
          return false
        }
      }
    }
    
    return true
  }
  
  // Création automatique du bon adaptateur
  async createImageProcessor(): Promise<IImageProcessor> {
    if (this.isWebGLAvailable()) {
      try {
        const { WebGLImageProcessor } = await import('../adapters/webgl-image-processor')
        const processor = new WebGLImageProcessor()
        
        if (processor.isAvailable()) {
          adapterLogger.info('Using WebGL hardware-accelerated image processor')
          return processor
        }
      } catch (error) {
        adapterLogger.warn('Failed to initialize WebGL processor, falling back to CPU:', error)
      }
    }
    
    // Fallback vers CPU
    const { CPUImageProcessor } = await import('../adapters/cpu-image-processor')
    const processor = new CPUImageProcessor()
    adapterLogger.info('Using CPU software image processor')
    return processor
  }
  
  async createPaletteProcessor(): Promise<IPaletteProcessor> {
    if (this.isWebGLAvailable()) {
      try {
        const { WebGLPaletteProcessor } = await import('../adapters/webgl-palette-processor')
        const processor = new WebGLPaletteProcessor()
        
        if (processor.isAvailable()) {
          adapterLogger.info('Using WebGL hardware-accelerated palette processor')
          return processor
        }
      } catch (error) {
        adapterLogger.warn('Failed to initialize WebGL palette processor, falling back to CPU:', error)
      }
    }
    
    // Fallback vers CPU
    const { CPUPaletteProcessor } = await import('../adapters/cpu-palette-processor')
    const processor = new CPUPaletteProcessor()
    adapterLogger.info('Using CPU software palette processor')
    return processor
  }

  // Nouvelle méthode pour le pipeline optimisé WebGL/CPU
  async createPipelineProcessor(): Promise<IImageProcessor> {
    if (this.isWebGLAvailable()) {
      try {
        const { WebGLPipelineProcessor } = await import('../adapters/webgl-pipeline-processor')
        const processor = new WebGLPipelineProcessor()
        
        if (processor.isAvailable()) {
          adapterLogger.info('Using WebGL optimized pipeline processor (multi-pass)')
          return processor
        }
      } catch (error) {
        adapterLogger.warn('Failed to initialize WebGL pipeline processor, falling back to CPU pipeline:', error)
      }
    }
    
    // Fallback vers le processeur pipeline CPU optimisé (pas le processeur normal)
    const { CPUPipelineProcessor } = await import('../adapters/cpu-pipeline-processor')
    const processor = new CPUPipelineProcessor()
    adapterLogger.info('Using CPU optimized pipeline processor')
    return processor
  }
}

// Singleton global pour faciliter l'usage
export const imageProcessorFactory = ImageProcessorFactory.getInstance()