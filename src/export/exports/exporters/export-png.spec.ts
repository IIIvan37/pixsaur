import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CpcModeConfig } from '@/app/store/config/types'
import { exportPNGData, type PNGExportData } from './export-png'

// Mock JSZip
const mockZipFile = vi.fn()
const mockZip = {
  file: mockZipFile
}

// Mock canvas and blob
const mockToBlob = vi.fn()
const mockCanvas = {
  width: 160,
  height: 200,
  getContext: vi.fn(() => ({
    putImageData: vi.fn(),
    fillStyle: '',
    fillRect: vi.fn(),
    imageSmoothingEnabled: true,
    drawImage: vi.fn()
  })),
  toBlob: mockToBlob
} as unknown as HTMLCanvasElement

// Helper to create a mock ImageData
function createMockImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  // Fill with black pixels
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0 // R
    data[i + 1] = 0 // G
    data[i + 2] = 0 // B
    data[i + 3] = 255 // A
  }
  return { data, width, height, colorSpace: 'srgb' as const } as ImageData
}

// Mock document.createElement to return controlled canvas
vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'canvas') {
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        putImageData: vi.fn(),
        fillStyle: '',
        fillRect: vi.fn(),
        imageSmoothingEnabled: true,
        drawImage: vi.fn()
      })),
      toBlob: (callback: (blob: Blob) => void) => {
        callback(new Blob(['test'], { type: 'image/png' }))
      }
    }
    return canvas as unknown as HTMLCanvasElement
  }
  return document.createElement(tagName)
})

describe('export-png', () => {
  const defaultModeConfig: CpcModeConfig = {
    mode: 0,
    width: 160,
    height: 200,
    overscan: false,
    nColors: 16,
    scaleX: 2,
    scaleY: 1
  }

  const defaultConfig = {
    filename: 'test',
    format: 'linear' as const,
    content: {
      includePNG: false,
      includePNGCorrected: false,
      includeASM: true,
      includeBIN: false,
      includePAL: true,
      includeSCR: false,
      includeRasters: false,
      includeLinear: true,
      includePalettes: true
    },
    labels: {
      enabled: false,
      media: 'pixsaur_data',
      palette: 'pixsaur_palette'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockToBlob.mockImplementation((callback: (blob: Blob) => void) => {
      callback(new Blob(['test'], { type: 'image/png' }))
    })
  })

  describe('exportPNGData', () => {
    it('should not export any PNG when both options are disabled', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNG: false,
          includePNGCorrected: false
        }
      }

      await exportPNGData(mockZip as any, mockCanvas, defaultModeConfig, config)

      expect(mockZipFile).not.toHaveBeenCalled()
    })

    it('should export square pixels PNG when includePNG is enabled', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNG: true,
          includePNGCorrected: false
        }
      }

      await exportPNGData(mockZip as any, mockCanvas, defaultModeConfig, config)

      expect(mockZipFile).toHaveBeenCalledTimes(1)
      expect(mockZipFile).toHaveBeenCalledWith('pixsaur.png', expect.any(Blob))
    })

    it('should export corrected aspect PNG without rasters when no raster data provided', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNG: false,
          includePNGCorrected: true
        }
      }

      await exportPNGData(mockZip as any, mockCanvas, defaultModeConfig, config)

      expect(mockZipFile).toHaveBeenCalledTimes(1)
      expect(mockZipFile).toHaveBeenCalledWith(
        'pixsaur_corrected_aspect.png',
        expect.any(Blob)
      )
    })

    it('should export corrected aspect PNG without rasters when raster data is undefined', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNG: false,
          includePNGCorrected: true
        }
      }

      await exportPNGData(
        mockZip as any,
        mockCanvas,
        defaultModeConfig,
        config,
        undefined
      )

      expect(mockZipFile).toHaveBeenCalledTimes(1)
      expect(mockZipFile).toHaveBeenCalledWith(
        'pixsaur_corrected_aspect.png',
        expect.any(Blob)
      )
    })

    it('should export corrected aspect PNG with previewImage when provided', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNG: false,
          includePNGCorrected: true
        }
      }

      const rasterData: PNGExportData = {
        previewImage: createMockImageData(160, 200)
      }

      await exportPNGData(
        mockZip as any,
        mockCanvas,
        defaultModeConfig,
        config,
        rasterData
      )

      expect(mockZipFile).toHaveBeenCalledTimes(1)
      expect(mockZipFile).toHaveBeenCalledWith(
        'pixsaur_corrected_aspect.png',
        expect.any(Blob)
      )
    })

    it('should export both PNGs when both options are enabled', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNG: true,
          includePNGCorrected: true
        }
      }

      await exportPNGData(mockZip as any, mockCanvas, defaultModeConfig, config)

      expect(mockZipFile).toHaveBeenCalledTimes(2)
      expect(mockZipFile).toHaveBeenCalledWith('pixsaur.png', expect.any(Blob))
      expect(mockZipFile).toHaveBeenCalledWith(
        'pixsaur_corrected_aspect.png',
        expect.any(Blob)
      )
    })

    it('should fall back to canvas when previewImage is undefined', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNG: false,
          includePNGCorrected: true
        }
      }

      await exportPNGData(
        mockZip as any,
        mockCanvas,
        defaultModeConfig,
        config,
        undefined
      )

      // Should still export (fallback to canvas-based export)
      expect(mockZipFile).toHaveBeenCalledTimes(1)
      expect(mockZipFile).toHaveBeenCalledWith(
        'pixsaur_corrected_aspect.png',
        expect.any(Blob)
      )
    })
  })

  describe('aspect ratio handling', () => {
    it('should handle mode 0 aspect ratio (160x200 -> wider)', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNGCorrected: true
        }
      }

      const modeConfig: CpcModeConfig = {
        mode: 0,
        width: 160,
        height: 200,
        overscan: false,
        nColors: 16,
        scaleX: 2,
        scaleY: 1
      }

      await exportPNGData(mockZip as any, mockCanvas, modeConfig, config)

      expect(mockZipFile).toHaveBeenCalledWith(
        'pixsaur_corrected_aspect.png',
        expect.any(Blob)
      )
    })

    it('should handle mode 1 aspect ratio (320x200)', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNGCorrected: true
        }
      }

      const modeConfig: CpcModeConfig = {
        mode: 1,
        width: 320,
        height: 200,
        overscan: false,
        nColors: 4,
        scaleX: 1,
        scaleY: 1
      }

      const canvas = {
        ...mockCanvas,
        width: 320,
        height: 200
      } as unknown as HTMLCanvasElement

      await exportPNGData(mockZip as any, canvas, modeConfig, config)

      expect(mockZipFile).toHaveBeenCalledWith(
        'pixsaur_corrected_aspect.png',
        expect.any(Blob)
      )
    })

    it('should handle mode 2 aspect ratio (640x200)', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNGCorrected: true
        }
      }

      const modeConfig: CpcModeConfig = {
        mode: 2,
        width: 640,
        height: 200,
        overscan: false,
        nColors: 2,
        scaleX: 1,
        scaleY: 2
      }

      const canvas = {
        ...mockCanvas,
        width: 640,
        height: 200
      } as unknown as HTMLCanvasElement

      await exportPNGData(mockZip as any, canvas, modeConfig, config)

      expect(mockZipFile).toHaveBeenCalledWith(
        'pixsaur_corrected_aspect.png',
        expect.any(Blob)
      )
    })
  })

  describe('previewImage usage', () => {
    it('should use previewImage directly for corrected aspect PNG when provided', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNGCorrected: true
        }
      }

      // Create a mock preview image (with rasters already applied)
      const previewImage = createMockImageData(4, 4)

      const rasterData: PNGExportData = {
        previewImage
      }

      const modeConfig: CpcModeConfig = {
        mode: 0,
        width: 4,
        height: 4,
        overscan: false,
        nColors: 16,
        scaleX: 2,
        scaleY: 1
      }

      await exportPNGData(
        mockZip as any,
        mockCanvas,
        modeConfig,
        config,
        rasterData
      )

      // The PNG should be generated from previewImage
      expect(mockZipFile).toHaveBeenCalledWith(
        'pixsaur_corrected_aspect.png',
        expect.any(Blob)
      )
    })
  })
})
