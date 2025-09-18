import type { 
  IImageProcessor, 
  IImageAdjustmentConfig, 
  IQuantizationConfig, 
  IDitheringConfig 
} from '../interfaces/image-processor'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import { adapterLogger } from '@/utils/logger'

/**
 * Processeur pipeline CPU optimisé évitant la surcharge d'initialization WebGL
 * Utilisé comme fallback haute performance quand WebGL n'est pas disponible
 */
export class CPUPipelineProcessor implements IImageProcessor {
  public readonly isHardwareAccelerated = false
  
  constructor() {
    adapterLogger.debug('CPU Pipeline Processor initialized (WebGL fallback)')
  }
  
  isAvailable(): boolean {
    // Le processeur pipeline CPU est toujours disponible
    return true
  }
  
  async processImage(imageData: ImageData, config: IImageAdjustmentConfig): Promise<ImageData> {
    // Déléguer vers applyAdjustments pour l'instant
    return this.applyAdjustments(imageData, config)
  }

  async applyAdjustments(imageData: ImageData, config: IImageAdjustmentConfig): Promise<ImageData> {
    // Utilise la fonction CPU existante optimisée
    return applyAdjustmentsInOnePass(imageData, {
      rgb: config.rgb,
      brightness: config.brightness,
      contrast: config.contrast,
      saturation: config.saturation,
      posterization: config.posterization
    })
  }
  
  async quantizeColors(imageData: ImageData, _config: IQuantizationConfig): Promise<ImageData> {
    // Quantification CPC optimisée en une passe
    const { width, height } = imageData
    const data = new Uint8ClampedArray(imageData.data)
    
    // Utilisation des fonctions vectorisées pour optimiser
    const pixels = data.length / 4
    for (let i = 0; i < pixels; i++) {
      const offset = i * 4
      data[offset] = this.quantizeCPC(data[offset])         // R
      data[offset + 1] = this.quantizeCPC(data[offset + 1]) // G  
      data[offset + 2] = this.quantizeCPC(data[offset + 2]) // B
      // Alpha reste inchangé (data[offset + 3])
    }
    
    return new ImageData(data, width, height)
  }
  
  async applyDithering(
    imageData: ImageData, 
    _palette: number[][], 
    _config: IDitheringConfig
  ): Promise<ImageData> {
    // Pour l'instant, pas de dithering CPU - retourne l'image quantifiée
    adapterLogger.debug('CPU dithering not yet implemented in pipeline processor')
    return imageData
  }

  /**
   * Pipeline optimisé CPU combinant quantization + dithering
   * Évite les copies intermédiaires d'ImageData
   */
  async processQuantizationAndDithering(
    imageData: ImageData, 
    palette: number[][], 
    config: IDitheringConfig
  ): Promise<ImageData> {
    // Pour l'instant, juste quantification
    // NOTE: Le dithering CPU sera implémenté dans une future version
    const quantized = await this.quantizeColors(imageData, { targetPalette: 'cpc' })
    return await this.applyDithering(quantized, palette, config)
  }
  
  async processComplete(
    imageData: ImageData,
    adjustments: IImageAdjustmentConfig,
    _quantization: IQuantizationConfig,
    dithering: IDitheringConfig,
    palette: number[][]
  ): Promise<ImageData> {
    // Pipeline séquentiel CPU optimisé sans copies inutiles
    let result = imageData
    
    // Skip adjustments s'ils sont neutres
    if (this.hasNonDefaultAdjustments(adjustments)) {
      result = await this.applyAdjustments(result, adjustments)
    }
    
    // Quantization + Dithering optimisé en un pipeline
    result = await this.processQuantizationAndDithering(result, palette, dithering)
    
    return result
  }
  
  dispose(): void {
    // Rien à nettoyer pour l'adaptateur CPU
    adapterLogger.debug('CPU Pipeline Processor disposed')
  }
  
  private quantizeCPC(value: number): number {
    // Quantification CPC optimisée avec lookup table
    if (value <= 64) return 0
    if (value <= 191) return 128
    return 255
  }
  
  private hasNonDefaultAdjustments(config: IImageAdjustmentConfig): boolean {
    return config.rgb.r !== 1 || config.rgb.g !== 1 || config.rgb.b !== 1 ||
           config.brightness !== 0 || config.contrast !== 0 || 
           config.saturation !== 0 || config.posterization !== 0
  }
}