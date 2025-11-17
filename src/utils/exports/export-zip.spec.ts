import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CpcModeConfig } from '@/app/store/config/types'
import { CPCHardware } from '@/libs/types'
import { exportZip } from './export-zip'
import type { ExportConfig } from './types'

// Mock dependencies
vi.mock('../is-tauri', () => ({
  isTauri: vi.fn()
}))

vi.mock('@/tauri', () => ({
  saveZipFileTauri: vi.fn()
}))

vi.mock('./cpc-plus-format', () => ({
  paletteToCPCPlusValues: vi.fn((palette) => palette.map(() => 0x0fff))
}))

vi.mock('./exporters', () => ({
  exportSCRPlus: vi.fn(),
  exportSCRClassic: vi.fn(),
  exportLinearData: vi.fn(),
  exportPalettePlus: vi.fn(),
  exportPalettesClassic: vi.fn(),
  exportPNGData: vi.fn()
}))

describe('export-zip', () => {
  let mockCanvas: HTMLCanvasElement
  let mockContext: CanvasRenderingContext2D
  let mockConfig: ExportConfig
  let mockModeConfig: CpcModeConfig

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock canvas and context
    const imageData = new ImageData(320, 200)
    mockContext = {
      getImageData: vi.fn(() => imageData)
    } as unknown as CanvasRenderingContext2D

    mockCanvas = {
      width: 320,
      height: 200,
      getContext: vi.fn(() => mockContext)
    } as unknown as HTMLCanvasElement

    // Default config
    mockConfig = {
      filename: 'test-export',
      labels: {
        enabled: false,
        media: 'test_data',
        palette: 'test_palette'
      },
      content: {
        includeSCR: true,
        includeLinear: true,
        includePalettes: true,
        includePNG: false,
        includePNGCorrected: false
      }
    } as ExportConfig

    // Default mode config
    mockModeConfig = {
      mode: 1,
      width: 320,
      height: 200,
      overscan: false
    } as CpcModeConfig

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    // Mock document.createElement for <a> tag
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn()
    }
    vi.spyOn(document, 'createElement').mockReturnValue(
      mockLink as unknown as HTMLAnchorElement
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('CPC Classic export', () => {
    it('should export CPC Classic ZIP in browser', async () => {
      const { isTauri } = await import('../is-tauri')
      vi.mocked(isTauri).mockReturnValue(false)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      const result = await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.CLASSIC,
        undefined,
        mockConfig
      )

      expect(result).toBe(true)
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()

      const mockLink = document.createElement('a') as any
      expect(mockLink.click).toHaveBeenCalled()
      expect(mockLink.download).toBe('test-export.zip')
    })

    it('should export CPC Classic ZIP in Tauri', async () => {
      const { isTauri } = await import('../is-tauri')
      const { saveZipFileTauri } = await import('@/tauri')

      vi.mocked(isTauri).mockReturnValue(true)
      vi.mocked(saveZipFileTauri).mockResolvedValue(true)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      const result = await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.CLASSIC,
        undefined,
        mockConfig
      )

      expect(result).toBe(true)
      expect(saveZipFileTauri).toHaveBeenCalledWith(
        expect.any(Blob),
        'test-export.zip'
      )
      expect(global.URL.createObjectURL).not.toHaveBeenCalled()
    })

    it('should use custom ASM label when enabled', async () => {
      const { isTauri } = await import('../is-tauri')
      const { exportSCRClassic } = await import('./exporters')

      vi.mocked(isTauri).mockReturnValue(false)

      const configWithLabel = {
        ...mockConfig,
        labels: {
          enabled: true,
          media: 'custom_label',
          palette: 'custom_palette'
        }
      }

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.CLASSIC,
        undefined,
        configWithLabel
      )

      expect(exportSCRClassic).toHaveBeenCalledWith(
        expect.anything(),
        indexBuf,
        paletteFirmware,
        mockModeConfig,
        configWithLabel,
        'custom_label',
        true // isStandardMode for 320x200 mode 1
      )
    })

    it('should detect standard mode for mode 0 (160x200)', async () => {
      const { isTauri } = await import('../is-tauri')
      const { exportSCRClassic } = await import('./exporters')

      vi.mocked(isTauri).mockReturnValue(false)

      const mode0Config = {
        mode: 0,
        width: 160,
        height: 200,
        overscan: false
      } as CpcModeConfig

      mockCanvas.width = 160
      const imageData = new ImageData(160, 200)
      vi.mocked(mockContext.getImageData).mockReturnValue(imageData)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mode0Config,
        CPCHardware.CLASSIC,
        undefined,
        mockConfig
      )

      expect(exportSCRClassic).toHaveBeenCalledWith(
        expect.anything(),
        indexBuf,
        paletteFirmware,
        mode0Config,
        mockConfig,
        expect.any(String),
        true // isStandardMode
      )
    })

    it('should detect standard mode for mode 2 (640x200)', async () => {
      const { isTauri } = await import('../is-tauri')
      const { exportSCRClassic } = await import('./exporters')

      vi.mocked(isTauri).mockReturnValue(false)

      const mode2Config = {
        mode: 2,
        width: 640,
        height: 200,
        overscan: false
      } as CpcModeConfig

      mockCanvas.width = 640
      const imageData = new ImageData(640, 200)
      vi.mocked(mockContext.getImageData).mockReturnValue(imageData)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mode2Config,
        CPCHardware.CLASSIC,
        undefined,
        mockConfig
      )

      expect(exportSCRClassic).toHaveBeenCalledWith(
        expect.anything(),
        indexBuf,
        paletteFirmware,
        mode2Config,
        mockConfig,
        expect.any(String),
        true // isStandardMode
      )
    })

    it('should detect non-standard mode for custom dimensions', async () => {
      const { isTauri } = await import('../is-tauri')
      const { exportSCRClassic } = await import('./exporters')

      vi.mocked(isTauri).mockReturnValue(false)

      const customConfig = {
        mode: 1,
        width: 400,
        height: 300,
        overscan: false
      } as CpcModeConfig

      mockCanvas.width = 400
      mockCanvas.height = 300
      const imageData = new ImageData(400, 300)
      vi.mocked(mockContext.getImageData).mockReturnValue(imageData)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        customConfig,
        CPCHardware.CLASSIC,
        undefined,
        mockConfig
      )

      expect(exportSCRClassic).toHaveBeenCalledWith(
        expect.anything(),
        indexBuf,
        paletteFirmware,
        customConfig,
        mockConfig,
        expect.any(String),
        false // NOT standard mode
      )
    })

    it('should detect non-standard mode for overscan', async () => {
      const { isTauri } = await import('../is-tauri')
      const { exportSCRClassic } = await import('./exporters')

      vi.mocked(isTauri).mockReturnValue(false)

      const overscanConfig = {
        mode: 1,
        width: 320,
        height: 200,
        overscan: true // Overscan enabled
      } as CpcModeConfig

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        overscanConfig,
        CPCHardware.CLASSIC,
        undefined,
        mockConfig
      )

      expect(exportSCRClassic).toHaveBeenCalledWith(
        expect.anything(),
        indexBuf,
        paletteFirmware,
        overscanConfig,
        mockConfig,
        expect.any(String),
        false // NOT standard mode because of overscan
      )
    })

    it('should include PNG when configured', async () => {
      const { isTauri } = await import('../is-tauri')
      const { exportPNGData } = await import('./exporters')

      vi.mocked(isTauri).mockReturnValue(false)

      const configWithPNG = {
        ...mockConfig,
        content: {
          ...mockConfig.content,
          includePNG: true,
          includePNGCorrected: false
        }
      }

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.CLASSIC,
        undefined,
        configWithPNG
      )

      expect(exportPNGData).toHaveBeenCalledWith(
        expect.anything(),
        mockCanvas,
        mockModeConfig,
        configWithPNG
      )
    })

    it('should include corrected PNG when configured', async () => {
      const { isTauri } = await import('../is-tauri')
      const { exportPNGData } = await import('./exporters')

      vi.mocked(isTauri).mockReturnValue(false)

      const configWithCorrectedPNG = {
        ...mockConfig,
        content: {
          ...mockConfig.content,
          includePNG: false,
          includePNGCorrected: true
        }
      }

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.CLASSIC,
        undefined,
        configWithCorrectedPNG
      )

      expect(exportPNGData).toHaveBeenCalled()
    })
  })

  describe('CPC Plus export', () => {
    it('should export CPC Plus ZIP with reduced palette', async () => {
      const { isTauri } = await import('../is-tauri')
      const { exportSCRPlus } = await import('./exporters')
      const { paletteToCPCPlusValues } = await import('./cpc-plus-format')

      vi.mocked(isTauri).mockReturnValue(false)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]
      const reducedPalette: Array<[number, number, number]> = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ]

      const result = await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.PLUS,
        reducedPalette,
        mockConfig
      )

      expect(result).toBe(true)
      expect(paletteToCPCPlusValues).toHaveBeenCalledWith(reducedPalette)
      expect(exportSCRPlus).toHaveBeenCalled()
    })

    it('should throw error when reduced palette is missing for CPC Plus', async () => {
      const { isTauri } = await import('../is-tauri')
      vi.mocked(isTauri).mockReturnValue(false)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      await expect(
        exportZip(
          indexBuf,
          paletteFirmware,
          mockCanvas,
          mockModeConfig,
          CPCHardware.PLUS,
          undefined, // No reduced palette
          mockConfig
        )
      ).rejects.toThrow('Reduced palette is required for CPC Plus export')
    })

    it('should export linear data for CPC Plus', async () => {
      const { isTauri } = await import('../is-tauri')
      const { exportLinearData } = await import('./exporters')

      vi.mocked(isTauri).mockReturnValue(false)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]
      const reducedPalette: Array<[number, number, number]> = [[255, 0, 0]]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.PLUS,
        reducedPalette,
        mockConfig
      )

      expect(exportLinearData).toHaveBeenCalledWith(
        expect.anything(),
        indexBuf,
        mockModeConfig,
        mockConfig,
        expect.any(String),
        true // isCPCPlus
      )
    })

    it('should export palette for CPC Plus', async () => {
      const { isTauri } = await import('../is-tauri')
      const { exportPalettePlus } = await import('./exporters')

      vi.mocked(isTauri).mockReturnValue(false)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]
      const reducedPalette: Array<[number, number, number]> = [[255, 0, 0]]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.PLUS,
        reducedPalette,
        mockConfig
      )

      expect(exportPalettePlus).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should return false when canvas context is null', async () => {
      const { isTauri } = await import('../is-tauri')
      vi.mocked(isTauri).mockReturnValue(false)

      mockCanvas.getContext = vi.fn(() => null)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      const result = await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.CLASSIC,
        undefined,
        mockConfig
      )

      expect(result).toBe(false)
    })

    it('should return false when getImageData returns null', async () => {
      const { isTauri } = await import('../is-tauri')
      vi.mocked(isTauri).mockReturnValue(false)

      vi.mocked(mockContext.getImageData).mockReturnValue(null as any)

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      const result = await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.CLASSIC,
        undefined,
        mockConfig
      )

      expect(result).toBe(false)
    })

    it('should return false when Tauri save is cancelled', async () => {
      const { isTauri } = await import('../is-tauri')
      const { saveZipFileTauri } = await import('@/tauri')

      vi.mocked(isTauri).mockReturnValue(true)
      vi.mocked(saveZipFileTauri).mockResolvedValue(false) // User cancelled

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      const result = await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.CLASSIC,
        undefined,
        mockConfig
      )

      expect(result).toBe(false)
    })
  })

  describe('Filename handling', () => {
    it('should use default filename when not provided', async () => {
      const { isTauri } = await import('../is-tauri')
      vi.mocked(isTauri).mockReturnValue(false)

      const configWithoutFilename: any = {
        ...mockConfig,
        filename: undefined
      }

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.CLASSIC,
        undefined,
        configWithoutFilename
      )

      const mockLink = document.createElement('a') as any
      expect(mockLink.download).toBe('pixsaur-export.zip')
    })

    it('should use custom filename when provided', async () => {
      const { isTauri } = await import('../is-tauri')
      vi.mocked(isTauri).mockReturnValue(false)

      const configWithCustomName = {
        ...mockConfig,
        filename: 'my-awesome-image'
      }

      const indexBuf = new Uint8Array([1, 2, 3])
      const paletteFirmware = [1, 2, 3, 4]

      await exportZip(
        indexBuf,
        paletteFirmware,
        mockCanvas,
        mockModeConfig,
        CPCHardware.CLASSIC,
        undefined,
        configWithCustomName
      )

      const mockLink = document.createElement('a') as any
      expect(mockLink.download).toBe('my-awesome-image.zip')
    })
  })
})
