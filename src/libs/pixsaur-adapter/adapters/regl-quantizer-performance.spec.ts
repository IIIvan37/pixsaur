import type { Regl } from 'regl'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { type ReGLQuantizeConfig, ReGLQuantizer } from './regl-quantizer'

// Mock ReGL pour benchmarks
const createBenchmarkMockRegl = (): Partial<Regl> => ({
  framebuffer: (() => ({ destroy: () => {}, use: (cb: any) => cb() })) as any,
  texture: (() => ({ destroy: () => {} })) as any,
  read: () => new Uint8Array(256 * 256 * 4),
  destroy: () => {},
  _gl: {
    canvas: document.createElement('canvas'),
    getExtension: () => ({}),
    getParameter: () => 16
  } as any
})

describe('ReGL Quantizer Performance Tests', () => {
  let quantizer: ReGLQuantizer

  beforeEach(() => {
    const mockRegl = createBenchmarkMockRegl()
    quantizer = new ReGLQuantizer(mockRegl as Regl)
  })

  const createTestPalette = (): Vector[] => [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
    [0, 0, 0],
    [255, 255, 255],
    [128, 128, 128],
    [192, 192, 192],
    [64, 64, 64],
    [128, 0, 0],
    [0, 128, 0],
    [0, 0, 128],
    [128, 128, 0],
    [128, 0, 128]
  ]

  const createRandomImageData = (width: number, height: number): ImageData => {
    const size = width * height * 4
    const data = new Uint8ClampedArray(size)

    for (let i = 0; i < size; i += 4) {
      // Générer des couleurs semi-aléatoires mais reproductibles
      const x = (i / 4) % width
      const y = Math.floor(i / 4 / width)

      data[i] = (x * 37 + y * 19) % 256 // R
      data[i + 1] = (x * 23 + y * 41) % 256 // G
      data[i + 2] = (x * 17 + y * 31) % 256 // B
      data[i + 3] = 255 // A
    }

    return new ImageData(data, width, height)
  }

  describe('Performance Benchmarks', () => {
    it('should handle small images efficiently', async () => {
      const imageData = createRandomImageData(16, 16) // 256 pixels
      const buffer = new Uint8ClampedArray(imageData.data)
      const palette = createTestPalette()

      const config: ReGLQuantizeConfig = {
        targetColors: 8,
        colorSpace: 'RGB',
        distanceMetric: 'euclidean'
      }

      const startTime = performance.now()

      const result = await quantizer.quantizePalette(
        buffer,
        imageData,
        palette,
        [],
        config
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(result).toBeDefined()
      expect(result.length).toBeLessThanOrEqual(8)
      expect(duration).toBeLessThan(200) // Moins de 200ms pour une petite image (test CI plus tolérant)
    })

    it('should scale reasonably with medium images', async () => {
      const imageData = createRandomImageData(64, 64) // 4096 pixels
      const buffer = new Uint8ClampedArray(imageData.data)
      const palette = createTestPalette()

      const config: ReGLQuantizeConfig = {
        targetColors: 16,
        colorSpace: 'RGB',
        distanceMetric: 'euclidean'
      }

      const startTime = performance.now()

      const result = await quantizer.quantizePalette(
        buffer,
        imageData,
        palette,
        [],
        config
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(result).toBeDefined()
      expect(result.length).toBeLessThanOrEqual(16)
      expect(duration).toBeLessThan(500) // Moins de 500ms pour une image moyenne
    })

    it('should maintain consistent performance across multiple runs', async () => {
      const imageData = createRandomImageData(32, 32) // 1024 pixels
      const buffer = new Uint8ClampedArray(imageData.data)
      const palette = createTestPalette()

      const config: ReGLQuantizeConfig = {
        targetColors: 8,
        colorSpace: 'RGB',
        distanceMetric: 'euclidean'
      }

      const times: number[] = []
      const runs = 5

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now()

        const result = await quantizer.quantizePalette(
          buffer,
          imageData,
          palette,
          [],
          config
        )

        const endTime = performance.now()
        times.push(endTime - startTime)

        expect(result).toBeDefined()
        expect(result.length).toBeLessThanOrEqual(8)
      }

      // Vérifier que les temps sont cohérents
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      const maxTime = Math.max(...times)
      const minTime = Math.min(...times)

      expect(avgTime).toBeLessThan(200) // Temps moyen raisonnable
      expect(maxTime - minTime).toBeLessThan(avgTime) // Variance acceptable
    })

    it('should handle different color spaces with similar performance', async () => {
      const imageData = createRandomImageData(32, 32)
      const buffer = new Uint8ClampedArray(imageData.data)
      const palette = createTestPalette()

      const configs = [
        {
          targetColors: 8,
          colorSpace: 'RGB' as const,
          distanceMetric: 'euclidean' as const
        },
        {
          targetColors: 8,
          colorSpace: 'Lab' as const,
          distanceMetric: 'cie76' as const
        }
      ]

      const times: Record<string, number> = {}

      for (const config of configs) {
        const startTime = performance.now()

        const result = await quantizer.quantizePalette(
          buffer,
          imageData,
          palette,
          [],
          config
        )

        const endTime = performance.now()
        times[config.colorSpace] = endTime - startTime

        expect(result).toBeDefined()
        expect(result.length).toBeLessThanOrEqual(8)
      }

      // Vérifier que les différences de performance sont raisonnables
      const rgbTime = times.RGB
      const labTime = times.Lab

      expect(rgbTime).toBeLessThan(200)
      expect(labTime).toBeLessThan(500) // Lab peut être plus lent
      expect(Math.abs(rgbTime - labTime)).toBeLessThan(1000) // Pas plus d'1 seconde de différence
    })

    it('should show performance characteristics by palette size', async () => {
      const imageData = createRandomImageData(32, 32)
      const buffer = new Uint8ClampedArray(imageData.data)
      const palette = createTestPalette()

      const paletteSizes = [2, 4, 8, 16]
      const times: Record<number, number> = {}

      for (const targetColors of paletteSizes) {
        const config: ReGLQuantizeConfig = {
          targetColors,
          colorSpace: 'RGB',
          distanceMetric: 'euclidean'
        }

        const startTime = performance.now()

        const result = await quantizer.quantizePalette(
          buffer,
          imageData,
          palette,
          [],
          config
        )

        const endTime = performance.now()
        times[targetColors] = endTime - startTime

        expect(result).toBeDefined()
        expect(result.length).toBeLessThanOrEqual(targetColors)
      }

      // Vérifier que tous les temps sont raisonnables
      paletteSizes.forEach((size) => {
        expect(times[size]).toBeLessThan(300) // Moins de 300ms pour chaque taille
      })

      // Le temps peut augmenter avec la taille de palette, mais pas drastiquement
      expect(times[16]).toBeLessThan(times[2] * 10) // Pas plus de 10x plus lent
    })
  })

  describe('Memory and Resource Efficiency', () => {
    it('should handle sequential quantizations without performance degradation', async () => {
      const imageData = createRandomImageData(24, 24)
      const buffer = new Uint8ClampedArray(imageData.data)
      const palette = createTestPalette()

      const config: ReGLQuantizeConfig = {
        targetColors: 8,
        colorSpace: 'RGB',
        distanceMetric: 'euclidean'
      }

      const times: number[] = []
      const iterations = 10

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()

        const result = await quantizer.quantizePalette(
          buffer,
          imageData,
          palette,
          [],
          config
        )

        const endTime = performance.now()
        times.push(endTime - startTime)

        expect(result).toBeDefined()
      }

      // Vérifier qu'il n'y a pas de dégradation significative
      const firstHalf = times.slice(0, 5)
      const secondHalf = times.slice(5, 10)

      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const avgSecond =
        secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

      // La seconde moitié ne devrait pas être significativement plus lente
      expect(avgSecond).toBeLessThan(avgFirst * 2) // Pas plus de 2x plus lent
    })

    it('should handle concurrent quantizations efficiently', async () => {
      const imageData = createRandomImageData(20, 20)
      const buffer = new Uint8ClampedArray(imageData.data)
      const palette = createTestPalette()

      const config: ReGLQuantizeConfig = {
        targetColors: 6,
        colorSpace: 'RGB',
        distanceMetric: 'euclidean'
      }

      const concurrencyLevels = [1, 2, 4]
      const times: Record<number, number> = {}

      for (const concurrency of concurrencyLevels) {
        const startTime = performance.now()

        const tasks = Array(concurrency)
          .fill(null)
          .map(() =>
            quantizer.quantizePalette(buffer, imageData, palette, [], config)
          )

        const results = await Promise.all(tasks)

        const endTime = performance.now()
        times[concurrency] = endTime - startTime

        results.forEach((result) => {
          expect(result).toBeDefined()
          expect(result.length).toBeLessThanOrEqual(6)
        })
      }

      // Vérifier que la performance ne se dégrade pas linéairement
      expect(times[2]).toBeLessThan(times[1] * 3) // Concurrence de 2 pas plus de 3x plus lent
      expect(times[4]).toBeLessThan(times[1] * 6) // Concurrence de 4 pas plus de 6x plus lent
    })
  })

  describe('Stress Tests', () => {
    it('should handle edge case scenarios efficiently', async () => {
      // Image avec très peu de couleurs distinctes
      const monoImageData = new ImageData(
        new Uint8ClampedArray(32 * 32 * 4).fill(128),
        32,
        32
      )
      const monoBuffer = new Uint8ClampedArray(monoImageData.data)

      // Palette très large
      const largePalette: Vector[] = Array(256)
        .fill(null)
        .map((_, i) => [i, (i * 2) % 256, (i * 3) % 256])

      const config: ReGLQuantizeConfig = {
        targetColors: 64,
        colorSpace: 'RGB',
        distanceMetric: 'euclidean'
      }

      const startTime = performance.now()

      const result = await quantizer.quantizePalette(
        monoBuffer,
        monoImageData,
        largePalette,
        [],
        config
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(result).toBeDefined()
      expect(duration).toBeLessThan(1000) // Moins d'1 seconde même pour un cas extrême
    })
  })
})
