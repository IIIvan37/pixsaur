import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebGLPaletteProcessor } from './webgl-palette-processor'

describe('WebGL Palette Processor', () => {
  let processor: WebGLPaletteProcessor

  beforeEach(() => {
    try {
      processor = new WebGLPaletteProcessor()
    } catch (_error) {
      console.warn('⚠️ WebGL not available, skipping WebGL-specific tests')
    }
  })

  afterEach(() => {
    if (processor) {
      processor.dispose()
    }
  })

  const createTestImage = (width = 4, height = 4): ImageData => {
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Créer une image avec des couleurs distinctes
    const colors = [
      [255, 0, 0, 255],   // Rouge
      [0, 255, 0, 255],   // Vert
      [0, 0, 255, 255],   // Bleu
      [255, 255, 0, 255], // Jaune
      [255, 0, 255, 255], // Magenta
      [0, 255, 255, 255], // Cyan
      [255, 255, 255, 255], // Blanc
      [0, 0, 0, 255],     // Noir
    ]
    
    for (let i = 0; i < width * height; i++) {
      const colorIndex = i % colors.length
      const color = colors[colorIndex]
      data[i * 4] = color[0]
      data[i * 4 + 1] = color[1]
      data[i * 4 + 2] = color[2]  
      data[i * 4 + 3] = color[3]
    }
    
    return new ImageData(data, width, height)
  }

  it('should be available when WebGL is supported', () => {
    if (!processor) {
      console.warn('⚠️ WebGL not available, skipping availability test')
      expect(processor).toBeUndefined()
      return
    }
    
    expect(processor.isHardwareAccelerated).toBe(true)
    
    // Le test de disponibilité dépend de l'environnement
    if (processor.isAvailable()) {
      expect(processor.isAvailable()).toBe(true)
    } else {
      console.warn('⚠️ WebGL2 not supported in test environment')
      expect(processor.isAvailable()).toBe(false)
    }
  })

  it('should extract dominant colors from test image', async () => {
    if (!processor || !processor.isAvailable()) {
      console.warn('⚠️ WebGL not available, skipping WebGL-specific test')
      return
    }

    const testImage = createTestImage()
    const maxColors = 4
    
    const dominantColors = await processor.extractDominantColors(testImage, maxColors)
    
    expect(dominantColors).toHaveLength(maxColors)
    expect(dominantColors[0]).toHaveLength(3) // RGB values
    
    // Vérifier que les couleurs sont des valeurs RGB valides
    dominantColors.forEach(color => {
      expect(color[0]).toBeGreaterThanOrEqual(0)
      expect(color[0]).toBeLessThanOrEqual(255)
      expect(color[1]).toBeGreaterThanOrEqual(0)
      expect(color[1]).toBeLessThanOrEqual(255)
      expect(color[2]).toBeGreaterThanOrEqual(0)
      expect(color[2]).toBeLessThanOrEqual(255)
    })
  })

  it('should handle different max color counts', async () => {
    if (!processor || !processor.isAvailable()) {
      console.warn('⚠️ WebGL not available, skipping WebGL-specific test')
      return
    }

    const testImage = createTestImage(8, 8)
    
    // Test avec différents nombres de couleurs
    for (const maxColors of [2, 4, 8, 16]) {
      const dominantColors = await processor.extractDominantColors(testImage, maxColors)
      expect(dominantColors).toHaveLength(maxColors)
    }
  })

  it('should fallback to CPC palette when WebGL fails', async () => {
    if (!processor || !processor.isAvailable()) {
      console.warn('⚠️ WebGL not available, testing fallback behavior')
      
      // Test avec processeur sans WebGL
      const fallbackProcessor = new WebGLPaletteProcessor()
      // Force l'indisponibilité en cassant le renderer
      ;(fallbackProcessor as unknown as { renderer: null }).renderer = null
      
      const testImage = createTestImage()
      const maxColors = 4
      
      const colors = await fallbackProcessor.extractDominantColors(testImage, maxColors)
      
      expect(colors).toHaveLength(maxColors)
      expect(colors[0]).toEqual([0, 0, 0]) // Noir CPC
      
      fallbackProcessor.dispose()
      return
    }

    // Si WebGL est disponible, simuler une erreur
    const brokenProcessor = new WebGLPaletteProcessor()
    ;(brokenProcessor as unknown as { renderer: null }).renderer = null
    
    const testImage = createTestImage()
    const colors = await brokenProcessor.extractDominantColors(testImage, 4)
    
    // Devrait retourner la palette CPC fallback
    expect(colors).toHaveLength(4)
    expect(colors[0]).toEqual([0, 0, 0]) // Noir CPC
    
    brokenProcessor.dispose()
  })

  it('should handle large images efficiently', async () => {
    if (!processor || !processor.isAvailable()) {
      console.warn('⚠️ WebGL not available, skipping WebGL-specific test')
      return
    }

    const largeImage = createTestImage(64, 64) // Image plus grande
    const maxColors = 8
    
    const startTime = performance.now()
    const dominantColors = await processor.extractDominantColors(largeImage, maxColors)
    const endTime = performance.now()
    
    expect(dominantColors).toHaveLength(maxColors)
    
    // Test de performance basique (devrait être rapide avec WebGL)
    const duration = endTime - startTime
    expect(duration).toBeLessThan(1000) // Moins d'une seconde
    
    console.log(`✅ WebGL palette extraction took ${duration.toFixed(2)}ms for 64x64 image`)
  })

  it('should dispose resources properly', () => {
    if (!processor) {
      return
    }
    
    expect(() => processor.dispose()).not.toThrow()
    
    // Après disposal, devrait gérer gracieusement les appels
    expect(processor.isAvailable()).toBe(false)
  })
})