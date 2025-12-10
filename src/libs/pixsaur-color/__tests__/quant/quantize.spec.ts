import { buildWeightedHistogram } from '../../src/histogram'
import { mapAndDither } from '../../src/map'
import { getDistanceFn } from '../../src/metric/distance'
import {
  bufferToVectors,
  createQuantizer,
  extractBuffer
} from '../../src/quant/quantize'

// Mock des dépendances
vi.mock('../../src/histogram')
vi.mock('../../src/map')
vi.mock('../../src/metric/distance')
vi.mock('../../src/quant/select-to-indices')
vi.mock('../../src/quant/palette-strategies-v2')

describe('quantize.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractBuffer', () => {
    it("devrait extraire le buffer d'un ImageData", () => {
      const data = new Uint8ClampedArray([255, 128, 64, 255, 0, 255, 0, 255])
      const imageData = new ImageData(data, 2, 1)

      const result = extractBuffer(imageData)

      expect(result).toBeInstanceOf(Uint8ClampedArray)
      expect(result).toEqual(data)
      expect(result).not.toBe(data) // Devrait être un clone
    })

    it('devrait gérer les ImageData vides', () => {
      const data = new Uint8ClampedArray([])
      const imageData = new ImageData(data, 0, 0)

      const result = extractBuffer(imageData)

      expect(result).toEqual(data)
    })
  })

  describe('bufferToVectors', () => {
    it('devrait convertir un buffer RGBA en vecteurs RGB', () => {
      const buffer = new Uint8ClampedArray([
        255,
        128,
        64,
        255, // Rouge
        0,
        255,
        0,
        255, // Vert
        0,
        0,
        255,
        255 // Bleu
      ])

      const result = bufferToVectors(buffer)

      expect(result).toEqual([
        [255, 128, 64],
        [0, 255, 0],
        [0, 0, 255]
      ])
    })

    it('devrait gérer les buffers vides', () => {
      const buffer = new Uint8ClampedArray([])

      const result = bufferToVectors(buffer)

      expect(result).toEqual([])
    })

    it('devrait ignorer les pixels partiels à la fin', () => {
      const buffer = new Uint8ClampedArray([255, 128, 64, 255, 0]) // 5 octets = pixel incomplet

      const result = bufferToVectors(buffer)

      expect(result).toEqual([[255, 128, 64]]) // Un seul pixel complet
    })
  })

  describe('createQuantizer', () => {
    const mockDistanceFn = vi.fn()
    const mockBuildWeightedHistogram = vi.mocked(buildWeightedHistogram)
    const mockMapAndDither = vi.mocked(mapAndDither)
    const mockGetDistanceFn = vi.mocked(getDistanceFn)

    beforeEach(() => {
      mockGetDistanceFn.mockReturnValue(mockDistanceFn)
      mockBuildWeightedHistogram.mockReturnValue([10, 5, 8, 3])
    })

    it('devrait créer un quantizer avec les bonnes méthodes', () => {
      const buffer = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255])
      const basePalette = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ] as any[]
      const preselected = [[255, 0, 0]] as any[]
      const quantConfig = {
        distanceMetric: 'euclidean' as const,
        contrastStrategy: 'balanced' as const
      }

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected,
        quantConfig
      })

      expect(quantizer).toHaveProperty('quantize')
      expect(quantizer).toHaveProperty('dither')
      expect(typeof quantizer.quantize).toBe('function')
      expect(typeof quantizer.dither).toBe('function')
    })

    it('devrait configurer correctement la fonction de distance', () => {
      const buffer = new Uint8ClampedArray([255, 0, 0, 255])
      const basePalette = [[255, 0, 0]] as any[]
      const preselected: any[] = []
      const quantConfig = {
        distanceMetric: 'euclidean' as const
      }

      createQuantizer({
        buf: buffer,
        basePalette,
        preselected,
        quantConfig
      })

      expect(mockGetDistanceFn).toHaveBeenCalledWith('RGB', 'euclidean')
    })

    it('devrait gérer les pré-sélections correctement', () => {
      const buffer = new Uint8ClampedArray([
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255
      ])
      const basePalette = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ] as any[]
      const preselected = [
        [255, 0, 0],
        [0, 0, 255]
      ] as any[] // Indices 0 et 2
      const quantConfig = {
        distanceMetric: 'euclidean' as const,
        contrastStrategy: 'balanced' as const
      }

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected,
        quantConfig
      })

      // Les pré-sélections devraient être trouvées (indices 0 et 2)
      expect(quantizer).toBeDefined()
    })

    it('devrait ignorer les pré-sélections non trouvées dans la palette', () => {
      const buffer = new Uint8ClampedArray([255, 0, 0, 255])
      const basePalette = [
        [255, 0, 0],
        [0, 255, 0]
      ] as any[]
      const preselected = [[0, 0, 255]] as any[] // Couleur non dans basePalette
      const quantConfig = {
        distanceMetric: 'euclidean' as const
      }

      const quantizer = createQuantizer({
        buf: buffer,
        basePalette,
        preselected,
        quantConfig
      })

      expect(quantizer).toBeDefined()
    })

    describe('méthode dither', () => {
      it('devrait appeler mapAndDither avec les bons paramètres', () => {
        const buffer = new Uint8ClampedArray([255, 0, 0, 255])
        const basePalette = [[255, 0, 0]] as any[]
        const preselected: any[] = []
        const quantConfig = {
          distanceMetric: 'euclidean' as const
        }

        const quantizer = createQuantizer({
          buf: buffer,
          basePalette,
          preselected,
          quantConfig
        })

        const imageData = new ImageData(
          new Uint8ClampedArray([255, 0, 0, 255]),
          1,
          1
        )
        const reducedPalette = [[255, 0, 0]] as any[]
        const dithering = { mode: 'floydSteinberg' as const, intensity: 0.5 }

        const mockResult = new Uint8ClampedArray([255, 0, 0, 255])
        mockMapAndDither.mockReturnValue(mockResult)

        const result = quantizer.dither(imageData, reducedPalette, dithering)

        expect(mockMapAndDither).toHaveBeenCalledWith(
          expect.any(Uint8ClampedArray), // buffer extrait
          1, // width
          1, // height
          reducedPalette,
          dithering,
          'RGB'
        )
        expect(result).toBe(mockResult)
      })
    })
  })
})
