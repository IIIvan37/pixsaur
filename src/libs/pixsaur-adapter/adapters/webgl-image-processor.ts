import type { 
  IImageProcessor, 
  IImageAdjustmentConfig, 
  IQuantizationConfig, 
  IDitheringConfig 
} from '../interfaces/image-processor'
import { WebGLImageProcessor as ExistingWebGLProcessor } from '@/libs/pixsaur-webgl/src/image-processor'
import type { ImageAdjustmentConfig } from '@/libs/pixsaur-webgl/src/image-processor'

export class WebGLImageProcessor implements IImageProcessor {
  public readonly isHardwareAccelerated = true
  private processor: ExistingWebGLProcessor | null = null
  
  constructor() {
    try {
      this.processor = new ExistingWebGLProcessor()
    } catch (error) {
      console.error('Failed to initialize WebGL processor:', error)
      this.processor = null
    }
  }
  
  isAvailable(): boolean {
    return this.processor !== null
  }
  
  async applyAdjustments(imageData: ImageData, config: IImageAdjustmentConfig): Promise<ImageData> {
    if (!this.processor) {
      throw new Error('WebGL processor not available')
    }
    
    // Convertir notre interface vers celle du WebGLImageProcessor existant
    const webglConfig: ImageAdjustmentConfig = {
      rgb: config.rgb,
      brightness: config.brightness,
      contrast: config.contrast,
      saturation: config.saturation,
      posterization: config.posterization
    }
    
    const result = this.processor.processAdjustments(imageData, webglConfig)
    if (!result) {
      throw new Error('WebGL adjustment processing failed')
    }
    
    return result
  }
  
  async quantizeColors(imageData: ImageData, _config: IQuantizationConfig): Promise<ImageData> {
    // TODO: Utiliser le shader CPC quantization existant
    // Pour l'instant, on utilise le CPU comme fallback
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
    // TODO: Utiliser les shaders dithering existants
    console.warn('WebGL Dithering not implemented yet')
    return imageData
  }
  
  async processComplete(
    imageData: ImageData,
    adjustments: IImageAdjustmentConfig,
    quantization: IQuantizationConfig,
    dithering: IDitheringConfig,
    palette: number[][]
  ): Promise<ImageData> {
    // Pipeline séquentiel pour commencer, optimisation multi-pass plus tard
    let result = await this.applyAdjustments(imageData, adjustments)
    result = await this.quantizeColors(result, quantization)
    result = await this.applyDithering(result, palette, dithering)
    return result
  }
  
  dispose(): void {
    if (this.processor) {
      this.processor.dispose()
      this.processor = null
    }
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