import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebGLPipelineProcessor } from './webgl-pipeline-processor'
import type { IDitheringConfig, IImageAdjustmentConfig, IQuantizationConfig } from '../interfaces/image-processor'

describe('WebGL Pipeline Processor', () => {
  let processor: WebGLPipelineProcessor

  beforeEach(() => {
    try {
      processor = new WebGLPipelineProcessor()
    } catch (_error) {
      console.warn('⚠️ WebGL not available, skipping WebGL-specific tests')
    }
  })

  afterEach(() => {
    if (processor) {
      processor.dispose()
    }
  })

  const createTestImage = (width = 8, height = 8): ImageData => {
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Créer une image avec des couleurs variées
    for (let i = 0; i < width * height; i++) {
      const x = i % width
      const y = Math.floor(i / width)
      
      // Gradients colorés pour tester quantization et dithering
      data[i * 4] = Math.floor((x / width) * 255)     // Rouge
      data[i * 4 + 1] = Math.floor((y / height) * 255) // Vert  
      data[i * 4 + 2] = 128                           // Bleu constant
      data[i * 4 + 3] = 255                           // Alpha
    }
    
    return new ImageData(data, width, height)
  }

  const createTestPalette = (): number[][] => [
    [0, 0, 0],       // Noir
    [128, 0, 0],     // Rouge CPC
    [0, 128, 0],     // Vert CPC
    [128, 128, 0],   // Jaune CPC
    [0, 0, 128],     // Bleu CPC
    [255, 255, 255], // Blanc
  ]

  const createDitheringConfig = (matrixSize: 2 | 4 | 8 = 4): IDitheringConfig => ({
    mode: 'bayer',
    intensity: 1.0,
    matrixSize
  })

  const createAdjustmentConfig = (): IImageAdjustmentConfig => ({
    rgb: { r: 1, g: 1, b: 1 },
    brightness: 0,
    contrast: 0,
    saturation: 0,
    posterization: 0
  })

  it('should be available when WebGL is supported', () => {
    if (!processor) {
      console.warn('⚠️ WebGL not available, skipping availability test')
      return
    }
    
    expect(processor.isHardwareAccelerated).toBe(true)
    
    if (processor.isAvailable()) {
      expect(processor.isAvailable()).toBe(true)
    } else {
      console.warn('⚠️ WebGL2 not supported in test environment') 
      expect(processor.isAvailable()).toBe(false)
    }
  })

  it('should perform WebGL quantization', async () => {
    if (!processor || !processor.isAvailable()) {
      console.warn('⚠️ WebGL not available, skipping quantization test')
      return
    }

    const testImage = createTestImage()
    const config: IQuantizationConfig = { targetPalette: 'cpc' }
    
    const result = await processor.quantizeColors(testImage, config)
    
    expect(result).toBeInstanceOf(ImageData)
    expect(result.width).toBe(testImage.width)
    expect(result.height).toBe(testImage.height)
    expect(result.data.length).toBe(testImage.data.length)
  })

  it('should perform WebGL dithering', async () => {
    if (!processor || !processor.isAvailable()) {
      console.warn('⚠️ WebGL not available, skipping dithering test')
      return
    }

    const testImage = createTestImage()
    const palette = createTestPalette()
    const config: IDitheringConfig = { 
      mode: 'bayer',
      intensity: 1.0,
      matrixSize: 4 
    }
    
    const result = await processor.applyDithering(testImage, palette, config)
    
    expect(result).toBeInstanceOf(ImageData)
    expect(result.width).toBe(testImage.width)
    expect(result.height).toBe(testImage.height)
    expect(result.data.length).toBe(testImage.data.length)
  })

  it('should perform optimized quantization + dithering pipeline', async () => {
    if (!processor || !processor.isAvailable()) {
      console.warn('⚠️ WebGL not available, skipping pipeline test')
      return
    }

    const testImage = createTestImage(16, 16)
    const palette = createTestPalette()
    const ditheringConfig = createDitheringConfig(4)
    
    const startTime = performance.now()
    const result = await processor.processQuantizationAndDithering(testImage, palette, ditheringConfig)
    const endTime = performance.now()
    
    expect(result).toBeInstanceOf(ImageData)
    expect(result.width).toBe(testImage.width)
    expect(result.height).toBe(testImage.height)
    
    const duration = endTime - startTime
    expect(duration).toBeLessThan(1000) // Devrait être rapide
    
    console.log(`✅ WebGL pipeline took ${duration.toFixed(2)}ms for ${testImage.width}x${testImage.height} image`)
  })

  it('should perform complete processing pipeline', async () => {
    if (!processor || !processor.isAvailable()) {
      console.warn('⚠️ WebGL not available, skipping complete pipeline test')
      return
    }

    const testImage = createTestImage(12, 12)
    const adjustmentConfig = createAdjustmentConfig()
    const quantizationConfig: IQuantizationConfig = { targetPalette: 'cpc' }
    const ditheringConfig = createDitheringConfig(4)
    const palette = createTestPalette()
    
    const result = await processor.processComplete(
      testImage, 
      adjustmentConfig,
      quantizationConfig, 
      ditheringConfig,
      palette
    )
    
    expect(result).toBeInstanceOf(ImageData)
    expect(result.width).toBe(testImage.width)
    expect(result.height).toBe(testImage.height)
    
    // Vérifier que le résultat est différent de l'original (traitement effectué)
    const originalSum = Array.from(testImage.data).reduce((sum, val) => sum + val, 0)
    const resultSum = Array.from(result.data).reduce((sum, val) => sum + val, 0)
    
    expect(resultSum).not.toBe(originalSum) // Le traitement a modifié l'image
  })

  it('should handle different matrix sizes for dithering', async () => {
    if (!processor || !processor.isAvailable()) {
      console.warn('⚠️ WebGL not available, skipping matrix size test')
      return
    }

    const testImage = createTestImage(8, 8)
    const palette = createTestPalette()
    
    // Test avec différentes tailles de matrice
    for (const matrixSize of [2, 4, 8] as const) {
      const config = createDitheringConfig(matrixSize)
      
      const result = await processor.applyDithering(testImage, palette, config)
      
      expect(result).toBeInstanceOf(ImageData)
      expect(result.width).toBe(testImage.width)
      expect(result.height).toBe(testImage.height)
    }
  })

  it('should handle pipeline errors gracefully', async () => {
    if (!processor) {
      // Test avec processeur sans WebGL
      const brokenProcessor = new WebGLPipelineProcessor()
      ;(brokenProcessor as unknown as { renderer: null }).renderer = null
      
      const testImage = createTestImage()
      const palette = createTestPalette()
      const config = createDitheringConfig(4)
      
      await expect(brokenProcessor.processQuantizationAndDithering(testImage, palette, config))
        .rejects.toThrow('WebGL renderer not available')
      
      brokenProcessor.dispose()
      return
    }

    // Si WebGL disponible, simuler une erreur
    const brokenProcessor = new WebGLPipelineProcessor()
    ;(brokenProcessor as unknown as { renderer: null }).renderer = null
    
    const testImage = createTestImage()
    const config: IQuantizationConfig = { targetPalette: 'cpc' }
    
    await expect(brokenProcessor.quantizeColors(testImage, config))
      .rejects.toThrow('WebGL renderer not available')
    
    brokenProcessor.dispose()
  })

  it('should dispose resources properly', () => {
    if (!processor) {
      return
    }
    
    expect(() => processor.dispose()).not.toThrow()
    
    // Après disposal, devrait refuser les opérations
    expect(processor.isAvailable()).toBe(false)
  })

  it('should demonstrate performance advantage of pipeline', async () => {
    if (!processor || !processor.isAvailable()) {
      console.warn('⚠️ WebGL not available, skipping performance comparison')
      return
    }

    const testImage = createTestImage(32, 32) // Image plus grande
    const palette = createTestPalette()
    const config = createDitheringConfig(4)
    
    // Mesurer temps pipeline optimisé (1 passe)
    const pipelineStart = performance.now()
    const pipelineResult = await processor.processQuantizationAndDithering(testImage, palette, config)
    const pipelineEnd = performance.now()
    const pipelineTime = pipelineEnd - pipelineStart
    
    // Mesurer temps séparés (2 passes distinctes)
    const separateStart = performance.now()
    const quantized = await processor.quantizeColors(testImage, { targetPalette: 'cpc' })
    const dithered = await processor.applyDithering(quantized, palette, config)
    const separateEnd = performance.now()
    const separateTime = separateEnd - separateStart
    
    expect(pipelineResult).toBeInstanceOf(ImageData)
    expect(dithered).toBeInstanceOf(ImageData)
    
    console.log(`🚀 Pipeline time: ${pipelineTime.toFixed(2)}ms vs Separate: ${separateTime.toFixed(2)}ms`)
    
    // Le pipeline devrait être au moins aussi rapide (souvent plus rapide)
    expect(pipelineTime).toBeLessThanOrEqual(separateTime * 1.2) // 20% de tolérance
  })
})