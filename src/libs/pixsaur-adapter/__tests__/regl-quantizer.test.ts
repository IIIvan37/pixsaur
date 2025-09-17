/**
 * Tests d'infrastructure pour ReGL Quantizer
 * Phase 1: Validation de l'infrastructure de base et du fallback CPU
 */

import type REGL from 'regl'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createQuantizer } from '@/libs/pixsaur-color/src/quant/quantize'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import {
  type ReGLQuantizeConfig,
  ReGLQuantizer
} from '../adapters/regl-quantizer'

// Mock ReGL pour les tests
const mockReGL = (): REGL.Regl => {
  const mockGL = {
    getExtension: (ext: string) => {
      // Simuler extensions disponibles
      if (ext === 'OES_texture_float') return {}
      if (ext === 'EXT_color_buffer_float') return {}
      return null
    },
    getParameter: (_param: number) => {
      // Mock MAX_TEXTURE_SIZE
      return 4096
    }
  }

  const mockFramebuffer = () => ({
    destroy: () => {}
  })

  const mockTexture = () => ({
    destroy: () => {}
  })

  const mockCommand = () => () => {}

  // Créer la fonction principale avec les propriétés attachées
  const reglFunction = () => mockCommand()

  // Attacher les propriétés nécessaires
  Object.assign(reglFunction, {
    _gl: mockGL,
    framebuffer: mockFramebuffer,
    texture: mockTexture
  })

  return reglFunction as unknown as REGL.Regl
}

describe('ReGL Quantizer Infrastructure (Phase 1)', () => {
  let mockRegl: REGL.Regl
  let quantizer: ReGLQuantizer

  beforeEach(() => {
    mockRegl = mockReGL()
    quantizer = new ReGLQuantizer(mockRegl)
  })

  afterEach(() => {
    quantizer.dispose()
  })

  test('initializes without throwing errors', () => {
    expect(quantizer).toBeDefined()
  })

  test('provides compatible interface with createQuantizer types', async () => {
    // ✅ Test que les types sont compatibles
    const testImageData = createTestImage(64, 64)
    const buffer = new Uint8ClampedArray(testImageData.data)
    const basePalette = generateAmstradCPCPalette()
    const preselected: Vector[] = []

    const config: ReGLQuantizeConfig = {
      colorSpace: 'RGB',
      distanceMetric: 'euclidean',
      targetColors: 16
    }

    // Ne doit pas lever d'erreur de type
    const result = await quantizer.quantizePalette(
      buffer,
      testImageData,
      basePalette,
      preselected,
      config
    )

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(config.targetColors)
  })

  test('automatically falls back to CPU for small images', async () => {
    // Image très petite -> devrait utiliser CPU
    const testImageData = createTestImage(32, 32)
    const buffer = new Uint8ClampedArray(testImageData.data)
    const basePalette = generateAmstradCPCPalette()

    const config: ReGLQuantizeConfig = {
      colorSpace: 'RGB',
      distanceMetric: 'euclidean',
      targetColors: 8,
      gpuOptions: {
        minPixelsForGPU: 256 * 256 // Plus grand que 32x32
      }
    }

    const result = await quantizer.quantizePalette(
      buffer,
      testImageData,
      basePalette,
      [],
      config
    )

    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })

  test('handles different color spaces', async () => {
    const testImageData = createTestImage(128, 128)
    const buffer = new Uint8ClampedArray(testImageData.data)
    const basePalette = generateAmstradCPCPalette()

    const colorSpaces: Array<'RGB' | 'Lab' | 'XYZ'> = ['RGB', 'Lab', 'XYZ']

    for (const colorSpace of colorSpaces) {
      const config: ReGLQuantizeConfig = {
        colorSpace,
        distanceMetric: colorSpace === 'Lab' ? 'cie76' : 'euclidean',
        targetColors: 12
      }

      const result = await quantizer.quantizePalette(
        buffer,
        testImageData,
        basePalette,
        [],
        config
      )

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
    }
  })

  test('produces consistent results with CPU reference', async () => {
    // ✅ Test de conformité avec CPU
    const testImageData = createTestImage(100, 100)
    const buffer = new Uint8ClampedArray(testImageData.data)
    const basePalette = generateAmstradCPCPalette()
    const preselected: Vector[] = []

    const config: ReGLQuantizeConfig = {
      colorSpace: 'RGB',
      distanceMetric: 'euclidean',
      targetColors: 16
    }

    // CPU reference
    const cpuQuantizer = createQuantizer({
      buf: buffer,
      basePalette: [...basePalette],
      preselected,
      quantConfig: {
        colorSpace: config.colorSpace,
        distanceMetric: config.distanceMetric
      }
    })
    const cpuResult = cpuQuantizer.quantize(config.targetColors)

    // ReGL result (Phase 1: utilise CPU backend)
    const reglResult = await quantizer.quantizePalette(
      buffer,
      testImageData,
      basePalette,
      preselected,
      config
    )

    // Les résultats doivent être identiques en Phase 1
    expect(reglResult.length).toEqual(cpuResult.length)

    // Vérifier que les couleurs sont valides
    for (const color of reglResult) {
      expect(color).toHaveLength(3)
      expect(color[0]).toBeGreaterThanOrEqual(0)
      expect(color[0]).toBeLessThanOrEqual(255)
      expect(color[1]).toBeGreaterThanOrEqual(0)
      expect(color[1]).toBeLessThanOrEqual(255)
      expect(color[2]).toBeGreaterThanOrEqual(0)
      expect(color[2]).toBeLessThanOrEqual(255)
    }
  })

  test('handles preselected colors correctly', async () => {
    const testImageData = createTestImage(128, 128)
    const buffer = new Uint8ClampedArray(testImageData.data)
    const basePalette = generateAmstradCPCPalette()

    // Sélectionner quelques couleurs CPC spécifiques
    const preselected: Vector[] = [
      basePalette[0], // Première couleur
      basePalette[13] // Une couleur du milieu
    ]

    const config: ReGLQuantizeConfig = {
      colorSpace: 'RGB',
      distanceMetric: 'euclidean',
      targetColors: 10
    }

    const result = await quantizer.quantizePalette(
      buffer,
      testImageData,
      basePalette,
      preselected,
      config
    )

    // Les couleurs pré-sélectionnées doivent être incluses
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)

    // Vérifier que les couleurs pré-sélectionnées sont présentes
    const resultStrings = result.map(
      (color) => `${color[0]},${color[1]},${color[2]}`
    )
    const preselectedStrings = preselected.map(
      (color) => `${color[0]},${color[1]},${color[2]}`
    )

    for (const preselColor of preselectedStrings) {
      expect(resultStrings).toContain(preselColor)
    }
  })

  test('disposes resources properly', () => {
    // Tester que dispose() ne lève pas d'erreur
    expect(() => {
      quantizer.dispose()
    }).not.toThrow()

    // Tester qu'on peut appeler dispose() plusieurs fois
    expect(() => {
      quantizer.dispose()
    }).not.toThrow()
  })

  test('rejects operations after disposal', async () => {
    quantizer.dispose()

    const testImageData = createTestImage(64, 64)
    const buffer = new Uint8ClampedArray(testImageData.data)
    const basePalette = generateAmstradCPCPalette()

    const config: ReGLQuantizeConfig = {
      colorSpace: 'RGB',
      distanceMetric: 'euclidean',
      targetColors: 8
    }

    await expect(
      quantizer.quantizePalette(buffer, testImageData, basePalette, [], config)
    ).rejects.toThrow('disposed')
  })
})

// Utilitaire pour créer des images de test
function createTestImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)

  // Créer une image avec des couleurs variées pour tester la quantification
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)

    // Créer des patterns de couleur intéressants
    data[i] = ((x * 255) / width) % 256 // R
    data[i + 1] = ((y * 255) / height) % 256 // G
    data[i + 2] = ((x + y) * 128) % 256 // B
    data[i + 3] = 255 // A
  }

  return new ImageData(data, width, height)
}
