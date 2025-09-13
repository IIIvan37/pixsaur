import type { ImageProcessor, ProcessorFactory } from './interfaces'
import { CpuImageProcessor } from './adapters/cpu-processor'

/**
 * Factory pour créer les processors d'image
 * Gère la sélection automatique CPU/WebGL avec fallback
 */
export class ImageProcessorFactory implements ProcessorFactory {
  private static instance: ImageProcessorFactory | null = null

  static getInstance(): ImageProcessorFactory {
    if (!ImageProcessorFactory.instance) {
      ImageProcessorFactory.instance = new ImageProcessorFactory()
    }
    return ImageProcessorFactory.instance
  }

  createBestProcessor(): ImageProcessor {
    // Pour l'instant, utilise uniquement CPU
    // WebGL sera ajouté dans la prochaine étape
    console.log('🔧 Creating CPU processor (WebGL not implemented yet)')
    return this.createCpuProcessor()
  }

  createCpuProcessor(): ImageProcessor {
    return new CpuImageProcessor()
  }

  createWebGlProcessor(): ImageProcessor | null {
    // WebGL processor sera implémenté dans la prochaine étape
    console.log('⚠️ WebGL processor not implemented yet')
    return null
  }

  isWebGlAvailable(): boolean {
    // Vérification WebGL sera ajoutée dans la prochaine étape
    return false
  }
}

// Instance globale pour faciliter l'utilisation
export const processorFactory = ImageProcessorFactory.getInstance()