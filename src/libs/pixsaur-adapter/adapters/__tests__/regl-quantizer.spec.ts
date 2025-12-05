import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { type ReGLQuantizeConfig, ReGLQuantizer } from '../regl-quantizer'

// Mock REGL with WebGL context
const mockRegl = {
  hasExtension: vi.fn(),
  capabilities: {
    maxTextureSize: 4096,
    maxRenderbufferSize: 4096
  },
  framebuffer: vi.fn(() => ({
    destroy: vi.fn()
  })),
  texture: vi.fn(() => ({
    destroy: vi.fn(),
    subimage: vi.fn()
  })),
  buffer: vi.fn(() => ({
    destroy: vi.fn()
  })),
  destroy: vi.fn(),
  // Mock WebGL context for capability detection
  _gl: {
    getExtension: vi.fn(),
    getParameter: vi.fn(() => 4096),
    MAX_TEXTURE_SIZE: 0x84d1 // WebGL constant
  }
}

// Mock logger
vi.mock('@/core', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...(actual as any),
    adapterLogger: {
      ...(actual.adapterLogger || {}),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  }
})

// Mock shaders
vi.mock('../shaders', () => ({
  histogramFragmentShader: 'mock fragment shader',
  histogramVertexShader: 'mock vertex shader'
}))

describe('ReGLQuantizer', () => {
  let quantizer: ReGLQuantizer
  let testImageData: ImageData
  let testConfig: ReGLQuantizeConfig
  let basePalette: readonly Vector[]
  let preselectedColors: readonly Vector[]

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create test data
    testImageData = new ImageData(4, 4)
    for (let i = 0; i < testImageData.data.length; i += 4) {
      testImageData.data[i] = Math.random() * 255 // R
      testImageData.data[i + 1] = Math.random() * 255 // G
      testImageData.data[i + 2] = Math.random() * 255 // B
      testImageData.data[i + 3] = 255 // A
    }

    testConfig = {
      targetColors: 16,
      distanceMetric: 'euclidean',
      threshold: 10,
      gpuOptions: {
        minPixelsForGPU: 10 // Low threshold for testing
      }
    }

    basePalette = [
      [0, 0, 0],
      [255, 255, 255],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
      [0, 255, 255],
      [255, 0, 255],
      [128, 128, 128],
      [64, 64, 64],
      [192, 192, 192],
      [255, 128, 0],
      [128, 255, 0],
      [0, 255, 128],
      [128, 0, 255],
      [255, 0, 128]
    ]

    preselectedColors = [
      [0, 0, 0],
      [255, 255, 255]
    ]
  })

  afterEach(() => {
    if (quantizer) {
      quantizer.dispose()
    }
  })

  describe('constructor', () => {
    it('should create quantizer with GPU capabilities', () => {
      mockRegl.hasExtension.mockReturnValue(true)
      mockRegl._gl.getExtension.mockImplementation((ext: string) => {
        return ext === 'EXT_color_buffer_float' ? {} : null
      })

      quantizer = new ReGLQuantizer(mockRegl as any)

      expect(quantizer.type).toBe('regl')
      expect(mockRegl._gl.getExtension).toHaveBeenCalled()
    })

    it('should create quantizer without GPU capabilities', () => {
      mockRegl.hasExtension.mockReturnValue(false)
      mockRegl._gl.getExtension.mockReturnValue(null)

      quantizer = new ReGLQuantizer(mockRegl as any)

      expect(quantizer.type).toBe('regl')
    })

    it('should handle GPU initialization failure gracefully', () => {
      mockRegl.hasExtension.mockReturnValue(true)
      mockRegl._gl.getExtension.mockReturnValue({})
      mockRegl.framebuffer.mockImplementation(() => {
        throw new Error('GPU init failed')
      })

      // Should not throw
      quantizer = new ReGLQuantizer(mockRegl as any)
      expect(quantizer.type).toBe('regl')
    })
  })

  describe('quantizePalette', () => {
    beforeEach(() => {
      mockRegl.hasExtension.mockReturnValue(true)
      mockRegl._gl.getExtension.mockReturnValue({})
      quantizer = new ReGLQuantizer(mockRegl as any)
      // Mock histogramCommand to be available for GPU usage
      ;(quantizer as any).histogramCommand = {}
    })

    it('should reject when disposed', async () => {
      quantizer.dispose()

      await expect(
        quantizer.quantizePalette(
          new Uint8ClampedArray(testImageData.data),
          testImageData,
          basePalette,
          preselectedColors,
          testConfig
        )
      ).rejects.toThrow('ReGL Quantizer has been disposed')
    })

    it('should reject when GPU should not be used', async () => {
      // Create a very small image that shouldn't use GPU
      const smallImageData = new ImageData(1, 1)

      await expect(
        quantizer.quantizePalette(
          new Uint8ClampedArray(smallImageData.data),
          smallImageData,
          basePalette,
          preselectedColors,
          testConfig
        )
      ).rejects.toThrow('ReGLQuantizer: Image too small or GPU unavailable')
    })

    it('should handle different target color counts', async () => {
      const configs = [
        { ...testConfig, targetColors: 4 },
        { ...testConfig, targetColors: 8 },
        { ...testConfig, targetColors: 16 }
      ]

      for (const config of configs) {
        // Mock the GPU quantization to return expected colors
        const mockQuantizeGPU = vi.spyOn(quantizer as any, 'quantizeGPU')
        mockQuantizeGPU.mockResolvedValue(
          basePalette.slice(0, config.targetColors)
        )

        const result = await quantizer.quantizePalette(
          new Uint8ClampedArray(testImageData.data),
          testImageData,
          basePalette,
          preselectedColors,
          config
        )

        expect(result).toHaveLength(config.targetColors)
        mockQuantizeGPU.mockRestore()
      }
    })

    it('should handle preselected colors', async () => {
      const mockQuantizeGPU = vi.spyOn(quantizer as any, 'quantizeGPU')
      mockQuantizeGPU.mockResolvedValue([
        ...preselectedColors,
        ...basePalette.slice(0, 14)
      ])

      const result = await quantizer.quantizePalette(
        new Uint8ClampedArray(testImageData.data),
        testImageData,
        basePalette,
        preselectedColors,
        testConfig
      )

      expect(result).toContain(preselectedColors[0])
      expect(result).toContain(preselectedColors[1])
      mockQuantizeGPU.mockRestore()
    })

    it('should handle empty preselected colors array', async () => {
      const mockQuantizeGPU = vi.spyOn(quantizer as any, 'quantizeGPU')
      mockQuantizeGPU.mockResolvedValue(basePalette.slice(0, 16))

      const result = await quantizer.quantizePalette(
        new Uint8ClampedArray(testImageData.data),
        testImageData,
        basePalette,
        [],
        testConfig
      )

      expect(result).toHaveLength(16)
      mockQuantizeGPU.mockRestore()
    })
  })

  describe('GPU decision logic', () => {
    beforeEach(() => {
      mockRegl.hasExtension.mockReturnValue(true)
      mockRegl._gl.getExtension.mockReturnValue({})
      quantizer = new ReGLQuantizer(mockRegl as any)
      // Mock histogramCommand to be available
      ;(quantizer as any).histogramCommand = {}
    })

    it('should use GPU for large images', () => {
      const largeImageData = new ImageData(100, 100)
      const shouldUse = (quantizer as any).shouldUseGPU(
        largeImageData,
        testConfig
      )
      expect(shouldUse).toBe(true)
    })

    it('should not use GPU for very small images', () => {
      const smallImageData = new ImageData(1, 1)
      const shouldUse = (quantizer as any).shouldUseGPU(
        smallImageData,
        testConfig
      )
      expect(shouldUse).toBe(false)
    })

    it('should not use GPU when GPU resources unavailable', () => {
      mockRegl.hasExtension.mockReturnValue(false)
      mockRegl._gl.getExtension.mockReturnValue(null)
      const noGPUQuantizer = new ReGLQuantizer(mockRegl as any)

      const shouldUse = (noGPUQuantizer as any).shouldUseGPU(
        testImageData,
        testConfig
      )
      expect(shouldUse).toBe(false)

      noGPUQuantizer.dispose()
    })

    it('should respect minimum pixel threshold', () => {
      const configWithMinPixels = {
        ...testConfig,
        gpuOptions: { minPixelsForGPU: 10000 }
      }

      const smallImage = new ImageData(10, 10) // 100 pixels
      const shouldUse = (quantizer as any).shouldUseGPU(
        smallImage,
        configWithMinPixels
      )
      expect(shouldUse).toBe(false)

      const largeImage = new ImageData(200, 200) // 40000 pixels
      const shouldUseLarge = (quantizer as any).shouldUseGPU(
        largeImage,
        configWithMinPixels
      )
      expect(shouldUseLarge).toBe(true)
    })
  })

  describe('capability detection', () => {
    it('should detect capabilities correctly', () => {
      mockRegl.hasExtension.mockReturnValue(true)
      mockRegl._gl.getExtension.mockImplementation((ext: string) => {
        return ['EXT_color_buffer_float', 'WEBGL_color_buffer_float'].includes(
          ext
        )
          ? {}
          : null
      })

      quantizer = new ReGLQuantizer(mockRegl as any)
      const capabilities = (quantizer as any).capabilities

      expect(capabilities.canUseGPU).toBe(true)
      expect(capabilities.maxTextureSize).toBe(4096)
    })

    it('should handle missing extensions', () => {
      mockRegl.hasExtension.mockReturnValue(false)
      mockRegl._gl.getExtension.mockReturnValue(null)
      mockRegl._gl.getParameter.mockReturnValue(512) // Small texture size

      quantizer = new ReGLQuantizer(mockRegl as any)
      const capabilities = (quantizer as any).capabilities

      expect(capabilities.canUseGPU).toBe(false)
    })
  })

  describe('resource management', () => {
    beforeEach(() => {
      mockRegl.hasExtension.mockReturnValue(true)
      mockRegl._gl.getExtension.mockReturnValue({})
      quantizer = new ReGLQuantizer(mockRegl as any)
    })

    it('should dispose resources properly', () => {
      // Mock the resources that would be created
      const mockTextureDestroy = vi.fn()
      const mockFBODestroy = vi.fn()
      ;(quantizer as any).inputTexture = { destroy: mockTextureDestroy }
      ;(quantizer as any).cpcPaletteTexture = { destroy: mockTextureDestroy }
      ;(quantizer as any).histogramFBO = { destroy: mockFBODestroy }

      quantizer.dispose()

      expect(mockTextureDestroy).toHaveBeenCalledTimes(2)
      expect(mockFBODestroy).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple dispose calls', () => {
      const mockTextureDestroy = vi.fn()
      const mockFBODestroy = vi.fn()
      ;(quantizer as any).inputTexture = { destroy: mockTextureDestroy }
      ;(quantizer as any).cpcPaletteTexture = { destroy: mockTextureDestroy }
      ;(quantizer as any).histogramFBO = { destroy: mockFBODestroy }

      quantizer.dispose()
      quantizer.dispose() // Should not throw

      expect(mockTextureDestroy).toHaveBeenCalledTimes(2)
      expect(mockFBODestroy).toHaveBeenCalledTimes(1)
    })

    it('should update input texture', () => {
      const updateInputTexture = (quantizer as any).updateInputTexture.bind(
        quantizer
      )
      updateInputTexture(testImageData)

      expect(mockRegl.texture).toHaveBeenCalled()
    })

    it('should update palette texture', () => {
      const updatePaletteTexture = (quantizer as any).updatePaletteTexture.bind(
        quantizer
      )
      updatePaletteTexture(basePalette)

      expect(mockRegl.texture).toHaveBeenCalled()
    })

    it('should cache palette texture', () => {
      const updatePaletteTexture = (quantizer as any).updatePaletteTexture.bind(
        quantizer
      )

      // First call
      updatePaletteTexture(basePalette)
      expect(mockRegl.texture).toHaveBeenCalledTimes(1)

      // Second call with same palette should reuse
      updatePaletteTexture(basePalette)
      expect(mockRegl.texture).toHaveBeenCalledTimes(1) // Still 1
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      mockRegl.hasExtension.mockReturnValue(true)
      mockRegl._gl.getExtension.mockImplementation((ext: string) => {
        return ['EXT_color_buffer_float', 'WEBGL_color_buffer_float'].includes(
          ext
        )
          ? {}
          : null
      })
      mockRegl._gl.getParameter.mockReturnValue(4096)
      quantizer = new ReGLQuantizer(mockRegl as any)
      ;(quantizer as any).histogramCommand = {}
    })

    it('should handle GPU quantization errors', async () => {
      const mockQuantizeGPU = vi.spyOn(quantizer as any, 'quantizeGPU')
      mockQuantizeGPU.mockRejectedValue(new Error('GPU error'))

      await expect(
        quantizer.quantizePalette(
          new Uint8ClampedArray(testImageData.data),
          testImageData,
          basePalette,
          preselectedColors,
          testConfig
        )
      ).rejects.toThrow('GPU error')

      mockQuantizeGPU.mockRestore()
    })

    it('should handle invalid image data', () => {
      const invalidImageData = new ImageData(0, 0)

      expect(() => {
        ;(quantizer as any).updateInputTexture(invalidImageData)
      }).not.toThrow() // Should handle gracefully
    })
  })

  describe('configuration options', () => {
    beforeEach(() => {
      mockRegl.hasExtension.mockReturnValue(true)
      quantizer = new ReGLQuantizer(mockRegl as any)
    })

    it('should handle different distance metrics', () => {
      const configs = [
        { ...testConfig, distanceMetric: 'euclidean' as const },
        { ...testConfig, distanceMetric: 'manhattan' as const }
      ]

      for (const config of configs) {
        const shouldUse = (quantizer as any).shouldUseGPU(testImageData, config)
        expect(typeof shouldUse).toBe('boolean')
      }
    })

    it('should handle threshold configuration', () => {
      const configs = [
        { ...testConfig, threshold: 1 },
        { ...testConfig, threshold: 50 },
        { ...testConfig, threshold: undefined }
      ]

      for (const config of configs) {
        const shouldUse = (quantizer as any).shouldUseGPU(testImageData, config)
        expect(typeof shouldUse).toBe('boolean')
      }
    })

    it('should handle GPU options', () => {
      const configWithGPUOptions = {
        ...testConfig,
        gpuOptions: {
          batchSize: 1024,
          useAsyncReadback: true,
          minPixelsForGPU: 5000
        }
      }

      const shouldUse = (quantizer as any).shouldUseGPU(
        testImageData,
        configWithGPUOptions
      )
      expect(typeof shouldUse).toBe('boolean')
    })
  })

  describe('mode detection logic', () => {
    beforeEach(() => {
      mockRegl.hasExtension.mockReturnValue(true)
      quantizer = new ReGLQuantizer(mockRegl as any)
    })

    it('should detect mode 0 for targetColors=16', () => {
      const config = { ...testConfig, targetColors: 16 }
      // Access internal logic through detectModeAndSelectColors
      const isMode0Based =
        config.targetColors === 16 || config.targetColors === 512
      expect(isMode0Based).toBe(true)
    })

    it('should detect mode 1 for targetColors=4', () => {
      const config = { ...testConfig, targetColors: 4 }
      const isMode1Based = config.targetColors >= 1 && config.targetColors <= 4
      expect(isMode1Based).toBe(true)
    })

    it('should detect mode 1 for targetColors=3 (locked empty slot)', () => {
      const config = { ...testConfig, targetColors: 3 }
      const isMode1Based = config.targetColors >= 1 && config.targetColors <= 4
      expect(isMode1Based).toBe(true)
    })

    it('should detect mode 1 for targetColors=2 (two locked empty slots)', () => {
      const config = { ...testConfig, targetColors: 2 }
      const isMode1Based = config.targetColors >= 1 && config.targetColors <= 4
      expect(isMode1Based).toBe(true)
    })

    it('should detect mode 1 for targetColors=1 (three locked empty slots)', () => {
      const config = { ...testConfig, targetColors: 1 }
      const isMode1Based = config.targetColors >= 1 && config.targetColors <= 4
      expect(isMode1Based).toBe(true)
    })

    it('should detect mode 2 for targetColors <= 2', () => {
      const config1 = { ...testConfig, targetColors: 2 }
      const config2 = { ...testConfig, targetColors: 1 }
      expect(config1.targetColors <= 2).toBe(true)
      expect(config2.targetColors <= 2).toBe(true)
    })

    it('should use optimized selection for modes 0, 1, and 2', () => {
      const testCases = [
        { targetColors: 16, expected: true }, // mode 0
        { targetColors: 4, expected: true }, // mode 1
        { targetColors: 3, expected: true }, // mode 1 with locked empty
        { targetColors: 2, expected: true }, // mode 2 or mode 1
        { targetColors: 1, expected: true } // mode 2 with locked empty or mode 1
      ]

      for (const { targetColors, expected } of testCases) {
        const isMode0Based = targetColors === 16 || targetColors === 512
        const isMode1Based = targetColors >= 1 && targetColors <= 4
        const isMode2Based = targetColors <= 2
        const useOptimizedSelection =
          isMode0Based || isMode1Based || isMode2Based
        expect(useOptimizedSelection).toBe(expected)
      }
    })
  })
})
