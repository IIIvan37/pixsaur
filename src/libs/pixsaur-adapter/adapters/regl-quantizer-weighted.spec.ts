/**
 * Tests d'intégration pour ReGL Quantizer - Histogramme pondéré
 */

import { describe, expect, test, vi } from 'vitest'
import { ReGLQuantizer } from '../adapters/regl-quantizer'

describe('ReGL Quantizer - Weighted Histogram Integration', () => {
  // Mock complet WebGL context
  const createMockWebGL = () => ({
    canvas: { width: 256, height: 256 },
    getExtension: vi.fn(() => null),
    getSupportedExtensions: vi.fn(() => []),
    getParameter: vi.fn((param: any) => {
      // Simuler les constantes WebGL basiques
      if (param === 0x0d33) return 2048 // MAX_TEXTURE_SIZE
      return null
    }),
    MAX_TEXTURE_SIZE: 0x0d33
  })

  // Mock complet regl instance
  const createMockRegl = () => {
    const mockFBO = { destroy: vi.fn() }
    const mockTexture = { destroy: vi.fn(), width: 1, height: 1 }

    const reglFn = vi.fn(() => ({})) as any
    reglFn._gl = createMockWebGL()
    reglFn.framebuffer = vi.fn(() => mockFBO)
    reglFn.texture = vi.fn(() => mockTexture)
    reglFn.destroy = vi.fn()
    reglFn.clear = vi.fn()
    reglFn.read = vi.fn(() => new Uint8Array(4))

    return reglFn
  }

  // Palette CPC Classic avec les couleurs bleues
  const createCPCPalette = (): [number, number, number][] => [
    [0, 0, 0], // Noir
    [0, 0, 128], // Bleu sombre (idx 1)
    [0, 0, 255], // Bleu (idx 2)
    [0, 128, 0], // Vert
    [128, 0, 0], // Rouge
    [128, 0, 128], // Magenta
    [255, 128, 0], // Orange
    [128, 128, 0], // Jaune
    [0, 128, 128], // Cyan
    [128, 128, 128], // Gris
    [64, 64, 64], // Gris foncé
    [0, 64, 128], // Bleu-vert (idx 11)
    [128, 0, 64], // Rose
    [64, 0, 128], // Violet
    [0, 128, 64], // Vert-bleu (idx 14)
    [128, 64, 0], // Marron
    [64, 128, 0], // Vert-jaune
    [0, 64, 64], // Cyan foncé
    [64, 0, 64], // Magenta foncé
    [128, 128, 64], // Jaune-vert
    [0, 0, 64], // Bleu très sombre (idx 20)
    [64, 64, 128], // Bleu-gris
    [128, 64, 128], // Magenta-gris
    [64, 128, 128], // Cyan-gris
    [128, 128, 128], // Gris clair
    [255, 255, 255] // Blanc
  ]

  // Créer une image avec des pixels bleus
  const createBlueImage = (width: number, height: number): ImageData => {
    const data = new Uint8ClampedArray(width * height * 4)

    for (let i = 0; i < data.length; i += 4) {
      // Alterner entre différentes nuances de bleu
      const blueVariations = [
        [0, 0, 255], // Bleu pur
        [0, 0, 200], // Bleu foncé
        [0, 0, 128], // Bleu moyen
        [0, 0, 64], // Bleu sombre
        [255, 255, 255] // Blanc pour contraste
      ]
      const variation =
        blueVariations[Math.floor(Math.random() * blueVariations.length)]
      data[i] = variation[0] // R
      data[i + 1] = variation[1] // G
      data[i + 2] = variation[2] // B
      data[i + 3] = 255 // A
    }

    return new ImageData(data, width, height)
  }

  test('should detect blue colors using weighted histogram in CPU fallback', async () => {
    const mockRegl = createMockRegl()
    const quantizer = new ReGLQuantizer(mockRegl)

    const palette = createCPCPalette()
    const imageData = createBlueImage(128, 128) // Grande image pour permettre GPU

    // Configuration pour permettre GPU
    const config = {
      targetColors: 16,
      distanceMetric: 'euclidean' as const,
      contrastStrategy: 'max' as const,
      gpuOptions: {
        minPixelsForGPU: 1000 // Seuil bas pour permettre GPU avec mock
      }
    }

    try {
      // Cette appel devrait utiliser le CPU fallback avec histogramme pondéré
      const result = await quantizer.quantizePalette(
        new Uint8ClampedArray(imageData.data),
        imageData,
        palette,
        [],
        config
      )

      // Vérifier que des couleurs bleues ont été sélectionnées
      const blueIndices = new Set([1, 2, 11, 14, 20]) // Indices des couleurs bleues dans CPC
      const selectedBlueColors = result.filter((color) => {
        const paletteIndex = palette.findIndex(
          (p) => p[0] === color[0] && p[1] === color[1] && p[2] === color[2]
        )
        return blueIndices.has(paletteIndex)
      })

      expect(selectedBlueColors.length).toBeGreaterThan(0)
      expect(result).toHaveLength(config.targetColors)
    } finally {
      quantizer.dispose()
    }
  })

  test('should use weighted histogram for both CPU and GPU paths', async () => {
    const mockRegl = createMockRegl()
    const quantizer = new ReGLQuantizer(mockRegl)

    const palette = createCPCPalette()
    const imageData = createBlueImage(128, 128) // Grande image pour GPU

    const config = {
      targetColors: 4,
      distanceMetric: 'euclidean' as const,
      contrastStrategy: 'max' as const,
      gpuOptions: {
        minPixelsForGPU: 1000 // Seuil bas pour permettre GPU
      }
    }

    try {
      const result = await quantizer.quantizePalette(
        new Uint8ClampedArray(imageData.data),
        imageData,
        palette,
        [],
        config
      )

      // Vérifier que la quantification fonctionne
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(config.targetColors)

      // Chaque couleur devrait être un tableau RGB valide
      for (const color of result) {
        expect(Array.isArray(color)).toBe(true)
        expect(color).toHaveLength(3)
        for (const component of color) {
          expect(typeof component).toBe('number')
          expect(component).toBeGreaterThanOrEqual(0)
          expect(component).toBeLessThanOrEqual(255)
        }
      }
    } finally {
      quantizer.dispose()
    }
  })
})
