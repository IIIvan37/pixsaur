/**
 * Tests pour ReGLProcessor - Adaptateur ReGL avec fallback CPU
 */

import { describe, expect, test, vi, beforeEach } from 'vitest'
import type REGL from 'regl'
import { ReGLProcessor } from './regl-processor'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import type { AdjustmentConfig } from '../interfaces'

// Mock des dépendances
vi.mock('@/libs/pixsaur-color/src/transform/color-transform/adjust')
vi.mock('@/libs/pixsaur-color/src/quant/quantize')
vi.mock('@/utils/logger')
vi.mock('@/app/store/config/config', () => ({
  contrastStrategyAtom: vi.fn()
}))
vi.mock('jotai', () => ({
  getDefaultStore: vi.fn(() => ({
    get: vi.fn(() => 'balanced')
  }))
}))

// Mock de document pour les tests WebGL
const mockCanvas = {
  getContext: vi.fn((contextType: string) => {
    if (contextType === 'webgl2') {
      return {
        MAX_TEXTURE_SIZE: 0x0d33,
        getParameter: vi.fn(() => 2048)
      }
    }
    if (contextType === 'webgl') {
      return {
        MAX_TEXTURE_SIZE: 0x0d33,
        getParameter: vi.fn(() => 1024)
      }
    }
    return null
  }),
  // Ajouter les méthodes nécessaires pour happy-dom
  appendChild: vi.fn(),
  removeChild: vi.fn(),
  parentNode: null,
  ownerDocument: document
}

const originalCreateElement = document.createElement
Object.defineProperty(document, 'createElement', {
  writable: true,
  value: vi.fn((tagName: string) => {
    if (tagName === 'canvas') {
      return mockCanvas
    }
    // Pour les autres éléments, utiliser l'implémentation originale
    return originalCreateElement.call(document, tagName)
  })
})

describe('ReGLProcessor', () => {
  let mockRegl: REGL.Regl
  let mockAdjustmentConfig: AdjustmentConfig

  beforeEach(() => {
    // Reset des mocks
    vi.clearAllMocks()

    // Configuration d'ajustement de test
    mockAdjustmentConfig = {
      rgb: { r: 1, g: 1, b: 1 },
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      vibrance: 0,
      temperature: 0,
      tint: 0,
      gamma: 1,
      exposure: 0,
      highlights: 0,
      shadows: 0,
      posterization: 0
    }

    // Mock ReGL complet
    mockRegl = {
      texture: vi.fn(() => ({
        destroy: vi.fn(),
        width: 1,
        height: 1
      })),
      framebuffer: vi.fn(() => ({
        use: vi.fn((callback) => callback()),
        destroy: vi.fn()
      })),
      read: vi.fn(),
      destroy: vi.fn()
    } as any
  })

  describe('Constructeur et disponibilité', () => {
    test('devrait être disponible même sans ReGL', () => {
      const processor = new ReGLProcessor()
      expect(processor.type).toBe('regl')
      expect(processor.isAvailable).toBe(true)
    })

    test('devrait initialiser avec ReGL si fourni et WebGL disponible', () => {
      const processor = new ReGLProcessor(mockRegl)
      expect(processor.isAvailable).toBe(true)
      // Le quantizer devrait être initialisé si ReGL est fourni
    })

    test('devrait gérer l\'échec d\'initialisation ReGL gracieusement', () => {
      // Mock ReGL qui échoue
      const failingRegl = {
        ...mockRegl,
        texture: vi.fn(() => {
          throw new Error('WebGL error')
        })
      } as any

      const processor = new ReGLProcessor(failingRegl)
      expect(processor.isAvailable).toBe(true) // Toujours disponible avec fallback
    })
  })

  describe('Évaluation des capacités WebGL', () => {
    test('devrait détecter WebGL 2.0 si disponible', () => {
      const processor = new ReGLProcessor()
      const capabilities = processor.getCapabilities()

      expect(capabilities).toHaveProperty('futureReGLCapable')
      expect(capabilities).toHaveProperty('webglVersion')
      expect(capabilities).toHaveProperty('maxTextureSize')
      expect(capabilities.currentMode).toBe('cpu-fallback')
    })

    test('devrait gérer l\'absence de WebGL', () => {
      // Mock document sans WebGL
      const originalCreateElement = document.createElement
      const mockCanvasNoWebGL = {
        getContext: vi.fn(() => null)
      }

      Object.defineProperty(document, 'createElement', {
        writable: true,
        value: vi.fn(() => mockCanvasNoWebGL)
      })

      const processor = new ReGLProcessor()
      const capabilities = processor.getCapabilities()

      expect(capabilities.futureReGLCapable).toBe(false)
      expect(capabilities.webglVersion).toBe(null)

      // Restaurer
      Object.defineProperty(document, 'createElement', {
        writable: true,
        value: originalCreateElement
      })
    })
  })

  describe('applyAdjustments - CPU fallback', () => {
    test('devrait utiliser applyAdjustmentsInOnePass en fallback CPU', async () => {
      const processor = new ReGLProcessor() // Sans ReGL = CPU fallback
      const imageData = new ImageData(2, 2)
      const mockResult = new ImageData(2, 2)

      const mockApplyAdjustments = vi.mocked(applyAdjustmentsInOnePass)
      mockApplyAdjustments.mockReturnValue(mockResult)

      const result = await processor.applyAdjustments(imageData, mockAdjustmentConfig)

      expect(mockApplyAdjustments).toHaveBeenCalledWith(
        imageData,
        expect.objectContaining({
          rgb: mockAdjustmentConfig.rgb,
          brightness: mockAdjustmentConfig.brightness
        })
      )
      expect(result).toBe(mockResult)
    })

    test('applyAdjustmentsSync devrait fonctionner comme applyAdjustments', () => {
      const processor = new ReGLProcessor()
      const imageData = new ImageData(2, 2)
      const mockResult = new ImageData(2, 2)

      const mockApplyAdjustments = vi.mocked(applyAdjustmentsInOnePass)
      mockApplyAdjustments.mockReturnValue(mockResult)

      const result = processor.applyAdjustmentsSync(imageData, mockAdjustmentConfig)

      expect(mockApplyAdjustments).toHaveBeenCalledWith(
        imageData,
        expect.objectContaining({
          rgb: mockAdjustmentConfig.rgb
        })
      )
      expect(result).toBe(mockResult)
    })
  })

  describe('quantizePalette - CPU fallback', () => {
    test('devrait utiliser createQuantizer en fallback CPU', async () => {
      const processor = new ReGLProcessor() // Sans ReGL = CPU fallback
      const buffer = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255])
      const dimensions = { width: 2, height: 1 }
      const basePalette: any[] = []
      const preselected: any[] = []
      const mockPalette = [[255, 0, 0], [0, 255, 0]]

      const mockQuantizer = {
        quantize: vi.fn(() => mockPalette)
      }
      const mockCreateQuantizer = vi.mocked(createQuantizer)
      mockCreateQuantizer.mockReturnValue(mockQuantizer as any)

      const result = await processor.quantizePalette(
        buffer,
        dimensions,
        2,
        basePalette,
        preselected
      )

      expect(mockCreateQuantizer).toHaveBeenCalledWith({
        buf: buffer,
        basePalette,
        preselected,
        quantConfig: expect.objectContaining({
          distanceMetric: 'euclidean',
          contrastStrategy: 'balanced'
        })
      })
      expect(mockQuantizer.quantize).toHaveBeenCalledWith(2)
      expect(result).toBe(mockPalette)
    })

    test('devrait accepter ImageData comme paramètre dimensions', async () => {
      const processor = new ReGLProcessor()
      const imageData = new ImageData(2, 1)
      const buffer = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255])
      const basePalette: any[] = []
      const preselected: any[] = []

      const mockQuantizer = {
        quantize: vi.fn(() => [[255, 0, 0]])
      }
      const mockCreateQuantizer = vi.mocked(createQuantizer)
      mockCreateQuantizer.mockReturnValue(mockQuantizer as any)

      await processor.quantizePalette(
        buffer,
        imageData,
        1,
        basePalette,
        preselected
      )

      expect(mockCreateQuantizer).toHaveBeenCalledWith({
        buf: buffer,
        basePalette,
        preselected,
        quantConfig: expect.any(Object)
      })
    })
  })

  describe('Nettoyage des ressources', () => {
    test('dispose devrait nettoyer les ressources ReGL', () => {
      const processor = new ReGLProcessor(mockRegl)
      const mockDispose = vi.fn()

      // Mock du quantizer avec dispose
      Object.defineProperty(processor, 'quantizer', {
        value: { dispose: mockDispose },
        writable: true
      })

      processor.dispose()

      expect(mockDispose).toHaveBeenCalled()
    })

    test('dispose devrait gérer les erreurs gracieusement', () => {
      const processor = new ReGLProcessor(mockRegl)

      Object.defineProperty(processor, 'quantizer', {
        value: {
          dispose: vi.fn(() => {
            throw new Error('Dispose error')
          })
        },
        writable: true
      })

      // Ne devrait pas throw
      expect(() => processor.dispose()).not.toThrow()
    })
  })
})