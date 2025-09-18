import { describe, it, expect, beforeAll } from 'vitest'
import { imageProcessorFactory } from '@/libs/pixsaur-adapter'
import type { IImageProcessor } from '@/libs/pixsaur-adapter'

describe('Image Processor Adapters', () => {
  let webglProcessor: IImageProcessor
  let cpuProcessor: IImageProcessor
  
  // Image de test simple 2x2 avec des valeurs moyennes pour voir les ajustements
  const testImageData = new ImageData(
    new Uint8ClampedArray([
      128, 0, 0, 255,    // Rouge moyen
      0, 128, 0, 255,    // Vert moyen  
      0, 0, 128, 255,    // Bleu moyen
      64, 64, 64, 255    // Gris foncé
    ]),
    2, 2
  )
  
  const testConfig = {
    rgb: { r: 1.0, g: 1.0, b: 1.0 },
    brightness: 1.2,
    contrast: 1.1,
    saturation: 1.0,
    posterization: 256
  }
  
  beforeAll(async () => {
    // Force la création des deux types d'adaptateurs pour les tests
    const factory = imageProcessorFactory
    
    // Essayer d'obtenir WebGL
    try {
      webglProcessor = await factory.createImageProcessor()
    } catch {
      // Si WebGL échoue, on testera seulement CPU
    }
    
    // Forcer CPU en mockant temporairement la détection WebGL
    const originalIsWebGL = factory.isWebGLAvailable
    factory.isWebGLAvailable = () => false
    
    cpuProcessor = await factory.createImageProcessor()
    
    // Restaurer la détection originale
    factory.isWebGLAvailable = originalIsWebGL
  })
  
  it('should create CPU processor successfully', async () => {
    expect(cpuProcessor).toBeDefined()
    expect(cpuProcessor.isHardwareAccelerated).toBe(false)
    expect(cpuProcessor.isAvailable()).toBe(true)
  })
  
  it('should apply adjustments with CPU processor', async () => {
    const result = await cpuProcessor.applyAdjustments(testImageData, testConfig)
    
    expect(result).toBeDefined()
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    expect(result.data.length).toBe(16) // 4 pixels * 4 channels
    
    // Vérifier que les données ont été modifiées (brightness > 1.0)
    expect(result.data[0]).toBeGreaterThan(testImageData.data[0]) // Rouge plus lumineux
    expect(result.data[5]).toBeGreaterThan(testImageData.data[5]) // Vert plus lumineux
    expect(result.data[10]).toBeGreaterThan(testImageData.data[10]) // Bleu plus lumineux
  })
  
  it('should apply quantization with CPU processor', async () => {
    const result = await cpuProcessor.quantizeColors(testImageData, {})
    
    expect(result).toBeDefined()
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    
    // Vérifier que les couleurs sont quantifiées aux niveaux CPC [0, 128, 255]
    for (let i = 0; i < result.data.length; i += 4) {
      const r = result.data[i]
      const g = result.data[i + 1]
      const b = result.data[i + 2]
      
      expect([0, 128, 255]).toContain(r)
      expect([0, 128, 255]).toContain(g)
      expect([0, 128, 255]).toContain(b)
    }
  })
  
  it('should process complete pipeline with CPU', async () => {
    const result = await cpuProcessor.processComplete(
      testImageData, 
      testConfig,
      {},
      { mode: 'none', intensity: 0 },
      [[255, 0, 0], [0, 255, 0], [0, 0, 255], [128, 128, 128]]
    )
    
    expect(result).toBeDefined()
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
  })
  
  // Tests conditionnels WebGL seulement si disponible
  it('should create WebGL processor if available', async () => {
    if (webglProcessor?.isHardwareAccelerated) {
      expect(webglProcessor.isHardwareAccelerated).toBe(true)
      expect(webglProcessor.isAvailable()).toBe(true)
      
      console.log('✅ WebGL processor available for testing')
    } else {
      console.log('⚠️ WebGL processor not available, skipping WebGL tests')
    }
  })
  
  it('should produce similar results between WebGL and CPU', async () => {
    // Test seulement si WebGL est disponible
    if (!webglProcessor?.isHardwareAccelerated) {
      console.log('⚠️ Skipping WebGL vs CPU comparison - WebGL not available')
      return
    }
    
    const cpuResult = await cpuProcessor.applyAdjustments(testImageData, testConfig)
    const webglResult = await webglProcessor.applyAdjustments(testImageData, testConfig)
    
    expect(cpuResult.width).toBe(webglResult.width)
    expect(cpuResult.height).toBe(webglResult.height)
    
    // Vérifier que les résultats sont relativement proches (peut avoir de légères différences de précision)
    const tolerance = 5 // Tolérance de 5 niveaux de couleur
    
    for (let i = 0; i < cpuResult.data.length; i += 4) {
      const cpuR = cpuResult.data[i]
      const cpuG = cpuResult.data[i + 1] 
      const cpuB = cpuResult.data[i + 2]
      
      const webglR = webglResult.data[i]
      const webglG = webglResult.data[i + 1]
      const webglB = webglResult.data[i + 2]
      
      expect(Math.abs(cpuR - webglR)).toBeLessThanOrEqual(tolerance)
      expect(Math.abs(cpuG - webglG)).toBeLessThanOrEqual(tolerance)
      expect(Math.abs(cpuB - webglB)).toBeLessThanOrEqual(tolerance)
    }
  })
})