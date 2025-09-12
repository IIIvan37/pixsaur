import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebGLImageProcessor } from './adapters/webgl-image-processor'
import type { IQuantizationConfig, IDitheringConfig } from './interfaces/image-processor'

describe('WebGL Extended Features', () => {
  let processor: WebGLImageProcessor

  beforeEach(() => {
    processor = new WebGLImageProcessor()
  })

  afterEach(() => {
    if (processor) {
      processor.dispose()
    }
  })

  // Image test simple 2x2
  const createTestImage = () => new ImageData(
    new Uint8ClampedArray([
      200, 100, 50, 255,  // Orange
      100, 200, 50, 255,  // Vert jaunâtre
      50, 100, 200, 255,  // Bleu
      150, 150, 150, 255  // Gris
    ]),
    2, 2
  )

  it('should be available when WebGL is supported', () => {
    // Peut échouer en environnement test sans WebGL
    const available = processor.isAvailable()
    expect(typeof available).toBe('boolean')
    
    if (available) {
      console.log('✅ WebGL processor available for advanced testing')
      expect(processor.isHardwareAccelerated).toBe(true)
    } else {
      console.log('⚠️ WebGL not available, skipping WebGL-specific tests')
    }
  })

  it('should quantize colors to CPC levels with WebGL', async () => {
    if (!processor.isAvailable()) return

    const testImage = createTestImage()
    const config: IQuantizationConfig = { targetPalette: 'cpc' }
    
    const result = await processor.quantizeColors(testImage, config)
    
    expect(result).toBeDefined()
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    expect(result.data.length).toBe(16)

    // Vérifier que les valeurs sont quantizées aux niveaux CPC (0, 128, 255)
    for (let i = 0; i < result.data.length; i += 4) {
      const r = result.data[i]
      const g = result.data[i + 1] 
      const b = result.data[i + 2]
      
      expect([0, 128, 255]).toContain(r)
      expect([0, 128, 255]).toContain(g) 
      expect([0, 128, 255]).toContain(b)
      expect(result.data[i + 3]).toBe(255) // Alpha intact
    }

    console.log('✅ WebGL CPC quantization successful')
  })

  it('should apply Bayer dithering with WebGL', async () => {
    if (!processor.isAvailable()) return

    const testImage = createTestImage()
    const palette = [
      [0, 0, 0],       // Noir
      [255, 255, 255], // Blanc  
      [255, 0, 0],     // Rouge
      [0, 255, 0],     // Vert
      [0, 0, 255]      // Bleu
    ]
    
    const config: IDitheringConfig = {
      mode: 'bayer',
      intensity: 0.1,
      matrixSize: 4
    }
    
    const result = await processor.applyDithering(testImage, palette, config)
    
    expect(result).toBeDefined()
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    expect(result.data.length).toBe(16)

    // Vérifier que l'image a été modifiée (dithering appliqué)
    let hasChanged = false
    for (let i = 0; i < result.data.length; i += 4) {
      if (result.data[i] !== testImage.data[i] || 
          result.data[i + 1] !== testImage.data[i + 1] ||
          result.data[i + 2] !== testImage.data[i + 2]) {
        hasChanged = true
        break
      }
    }

    expect(hasChanged).toBe(true)
    console.log('✅ WebGL Bayer dithering successful')
  })

  it('should handle complete pipeline with WebGL', async () => {
    if (!processor.isAvailable()) return

    const testImage = createTestImage()
    const adjustments = {
      rgb: { r: 1.1, g: 1.0, b: 0.9 },
      brightness: 1.1,
      contrast: 1.1,
      saturation: 1.0,
      posterization: 256
    }
    const quantization: IQuantizationConfig = { targetPalette: 'cpc' }
    const dithering: IDitheringConfig = {
      mode: 'bayer',
      intensity: 0.05,
      matrixSize: 2
    }
    const palette = [
      [0, 0, 0], [128, 0, 0], [255, 0, 0],
      [0, 128, 0], [128, 128, 0], [255, 128, 0],  
      [0, 255, 0], [128, 255, 0], [255, 255, 0],
      [0, 0, 128], [128, 0, 128], [255, 0, 128],
      [0, 128, 128], [128, 128, 128], [255, 128, 128],
      [0, 255, 128], [128, 255, 128], [255, 255, 128],
      [0, 0, 255], [128, 0, 255], [255, 0, 255],
      [0, 128, 255], [128, 128, 255], [255, 128, 255],
      [0, 255, 255], [128, 255, 255], [255, 255, 255]
    ]
    
    const result = await processor.processComplete(
      testImage, adjustments, quantization, dithering, palette
    )
    
    expect(result).toBeDefined()
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)

    console.log('✅ WebGL complete pipeline successful')
  })

  it('should fallback to CPU on WebGL errors gracefully', async () => {
    // Test avec un processeur invalide pour forcer l'erreur
    const brokenProcessor = new WebGLImageProcessor()
    // On simule une erreur en invalidant le renderer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(brokenProcessor as any).renderer = null
    
    const testImage = createTestImage()
    const config: IQuantizationConfig = { targetPalette: 'cpc' }
    
    // Ne devrait pas lever d'erreur, mais utiliser CPU fallback
    const result = await brokenProcessor.quantizeColors(testImage, config)
    
    expect(result).toBeDefined()
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)

    console.log('✅ WebGL fallback to CPU working')
    
    brokenProcessor.dispose()
  })
})