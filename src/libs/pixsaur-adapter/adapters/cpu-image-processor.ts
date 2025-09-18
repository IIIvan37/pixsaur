import type { 
  IImageProcessor, 
  IImageAdjustmentConfig, 
  IQuantizationConfig, 
  IDitheringConfig 
} from '../interfaces/image-processor'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'

export class CPUImageProcessor implements IImageProcessor {
  public readonly isHardwareAccelerated = false
  
  isAvailable(): boolean {
    // L'adaptateur CPU est toujours disponible
    return true
  }
  
  async applyAdjustments(imageData: ImageData, config: IImageAdjustmentConfig): Promise<ImageData> {
    // Utilise la fonction CPU existante
    return applyAdjustmentsInOnePass(imageData, {
      rgb: config.rgb,
      brightness: config.brightness,
      contrast: config.contrast,
      saturation: config.saturation,
      posterization: config.posterization
    })
  }
  
  async quantizeColors(imageData: ImageData, _config: IQuantizationConfig): Promise<ImageData> {
    // Quantification CPC traditionnelle pixel par pixel
    const data = new Uint8ClampedArray(imageData.data)
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = this.quantizeCPC(data[i])     // R
      data[i + 1] = this.quantizeCPC(data[i + 1]) // G  
      data[i + 2] = this.quantizeCPC(data[i + 2]) // B
      // Alpha reste inchangé
    }
    
    return new ImageData(data, imageData.width, imageData.height)
  }
  
  async applyDithering(
    imageData: ImageData, 
    _palette: number[][], 
    _config: IDitheringConfig
  ): Promise<ImageData> {
    // TODO: Implémenter le dithering CPU existant
    // Pour l'instant, retourne l'image sans dithering
    console.warn('CPU Dithering not implemented yet')
    return imageData
  }
  
  async processComplete(
    imageData: ImageData,
    adjustments: IImageAdjustmentConfig,
    quantization: IQuantizationConfig,
    dithering: IDitheringConfig,
    palette: number[][]
  ): Promise<ImageData> {
    // Pipeline séquentiel CPU : ajustements → quantification → dithering
    let result = await this.applyAdjustments(imageData, adjustments)
    result = await this.quantizeColors(result, quantization)
    result = await this.applyDithering(result, palette, dithering)
    return result
  }
  
  dispose(): void {
    // Rien à nettoyer pour l'adaptateur CPU
  }
  
  private quantizeCPC(value: number): number {
    const levels = [0, 128, 255]
    let best = levels[0]
    let bestDist = Math.abs(value - best)
    
    for (const lvl of levels) {
      const dist = Math.abs(value - lvl)
      if (dist < bestDist) {
        bestDist = dist
        best = lvl
      }
    }
    
    return best
  }
}