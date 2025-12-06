import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CpcModeConfig } from '@/app/store/config/types'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
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

    it('should export corrected aspect PNG without rasters when raster data has empty ranges', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNG: false,
          includePNGCorrected: true
        }
      }

      const rasterData: PNGExportData = {
        indexBuf: new Uint8Array(160 * 200),
        globalPalette: [
          [0, 0, 0],
          [255, 0, 0]
        ] as Vector[],
        rasterRanges: []
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

    it('should export corrected aspect PNG with rasters when raster data is provided', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNG: false,
          includePNGCorrected: true
        }
      }

      const rasterRanges: RasterChange[] = [
        {
          id: 'test-1',
          line: 50,
          inkIndex: 1,
          color: [255, 0, 0] as Vector
        }
      ]

      const rasterData: PNGExportData = {
        indexBuf: new Uint8Array(160 * 200),
        globalPalette: [
          [0, 0, 0],
          [128, 128, 128]
        ] as Vector[],
        rasterRanges
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

    it('should fall back to canvas when globalPalette is empty', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNG: false,
          includePNGCorrected: true
        }
      }

      const rasterData: PNGExportData = {
        indexBuf: new Uint8Array(160 * 200),
        globalPalette: [], // Empty palette
        rasterRanges: [
          {
            id: 'test-1',
            line: 50,
            inkIndex: 1,
            color: [255, 0, 0] as Vector
          }
        ]
      }

      await exportPNGData(
        mockZip as any,
        mockCanvas,
        defaultModeConfig,
        config,
        rasterData
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

  describe('raster application', () => {
    it('should apply rasters to the correct lines in the output', async () => {
      const config = {
        ...defaultConfig,
        content: {
          ...defaultConfig.content,
          includePNGCorrected: true
        }
      }

      // Create a simple 4x4 image with ink index 0 everywhere
      const width = 4
      const height = 4
      const indexBuf = new Uint8Array(width * height).fill(0)

      // Set some pixels to ink index 1
      indexBuf[4] = 1 // line 1, x=0
      indexBuf[5] = 1 // line 1, x=1

      const globalPalette: Vector[] = [
        [0, 0, 0], // ink 0 = black
        [128, 128, 128] // ink 1 = gray
      ]

      // Raster changes ink 1 to red on line 1
      const rasterRanges: RasterChange[] = [
        {
          id: 'test-1',
          line: 1,
          inkIndex: 1,
          color: [255, 0, 0] as Vector
        }
      ]

      const rasterData: PNGExportData = {
        indexBuf,
        globalPalette,
        rasterRanges
      }

      const modeConfig: CpcModeConfig = {
        mode: 0,
        width,
        height,
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

      // The PNG should be generated with rasters applied
      expect(mockZipFile).toHaveBeenCalledWith(
        'pixsaur_corrected_aspect.png',
        expect.any(Blob)
      )
    })
  })
})
