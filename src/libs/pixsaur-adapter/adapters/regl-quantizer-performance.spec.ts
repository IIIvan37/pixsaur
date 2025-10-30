/**
 * Test de performance pour l'histogramme pondéré optimisé
 */

import { ReGLQuantizer } from '../adapters/regl-quantizer'

// Mock WebGL pour les tests
const createMockWebGL = () => ({
  canvas: { width: 256, height: 256 },
  getExtension: vi.fn(() => null),
  getSupportedExtensions: vi.fn(() => []),
  getParameter: vi.fn((param: any) => {
    if (param === 0x0d33) return 2048 // MAX_TEXTURE_SIZE
    return null
  }),
  MAX_TEXTURE_SIZE: 0x0d33
})

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

// Palette CPC Classic
const createCPCPalette = (): [number, number, number][] => [
  [0, 0, 0],
  [0, 0, 128],
  [0, 0, 255],
  [0, 128, 0],
  [128, 0, 0],
  [128, 0, 128],
  [255, 128, 0],
  [128, 128, 0],
  [0, 128, 128],
  [128, 128, 128],
  [64, 64, 64],
  [0, 64, 128],
  [128, 0, 64],
  [64, 0, 128],
  [0, 128, 64],
  [128, 64, 0],
  [64, 128, 0],
  [0, 64, 64],
  [64, 0, 64],
  [128, 128, 64],
  [0, 0, 64],
  [64, 64, 128],
  [128, 64, 128],
  [64, 128, 128],
  [128, 128, 128],
  [255, 255, 255]
]

// Créer une grande image de test
const createLargeTestImage = (width: number, height: number): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let i = 0; i < data.length; i += 4) {
    // Mélange de couleurs avec beaucoup de bleus
    const colors = [
      [0, 0, 255],
      [0, 0, 200],
      [0, 0, 128],
      [0, 0, 64], // Bleus
      [255, 255, 255],
      [128, 128, 128],
      [255, 0, 0],
      [0, 255, 0] // Autres
    ]
    const color = colors[Math.floor(Math.random() * colors.length)]
    data[i] = color[0]
    data[i + 1] = color[1]
    data[i + 2] = color[2]
    data[i + 3] = 255
  }

  return new ImageData(data, width, height)
}

describe('Performance Test - Weighted Histogram Optimization', () => {
  test('should handle large images efficiently', async () => {
    const mockRegl = createMockRegl() as any
    const quantizer = new ReGLQuantizer(mockRegl)

    const palette = createCPCPalette()
    const imageData = createLargeTestImage(800, 600) // 480k pixels

    const startTime = performance.now()

    try {
      // Test the public API instead of private method
      const config = {
        targetColors: 16,
        distanceMetric: 'euclidean' as const,
        contrastStrategy: 'max' as const,
        gpuOptions: {
          minPixelsForGPU: 1000
        }
      }

      const result = await quantizer.quantizePalette(
        new Uint8ClampedArray(imageData.data),
        imageData,
        palette,
        [],
        config
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(
        `Performance test: ${imageData.width}x${imageData.height} = ${imageData.width * imageData.height} pixels`
      )
      console.log(`⏱️  Duration: ${duration.toFixed(2)}ms`)
      console.log(`Result length: ${result.length}`)

      // Vérifier que c'est rapide (< 500ms pour 480k pixels)
      expect(duration).toBeLessThan(500)

      // Vérifier que la quantification fonctionne
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(config.targetColors)
    } finally {
      quantizer.dispose()
    }
  })
})
