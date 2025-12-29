import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { CPCHardware } from '@/libs/types'

// Mock RASM WASM
let mockRasmInstance: any
let mockRasmModule: any
let mockAssembleResult: { success: boolean; output?: string }

// Mock fetch for template DSK
global.fetch = vi.fn() as any

// Mock dependencies - must be hoisted
const mockDskLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

const mockGenerateDskFilenames = vi.fn((index: number) => [`IMG${index}.SCR`])
const mockGenerateScrDskTemplate = vi.fn(() => 'MOCK_TEMPLATE_CODE')
const mockGenerateUniversalScrLoader = vi.fn(() => 'MOCK_LOADER_CODE')
const mockExportSCR = vi.fn(() => new Uint8Array(16384))
const mockInjectCPCPlusPaletteIntoSCR = vi.fn()
const mockInjectPaletteDataIntoSCR = vi.fn()
const mockExportLinearAsm = vi.fn(() => new Uint8Array(32768))
const mockSplitLinearIntoChunks = vi.fn(() => [
  { index: 1, data: new Uint8Array(16384) },
  { index: 2, data: new Uint8Array(16384) }
])
const mockCreateRasmInstance = vi.fn(async () => mockRasmInstance)
const mockReadDsk = vi.fn(() => new Uint8Array(184320))

vi.mock('@/core', () => ({
  dskLogger: mockDskLogger
}))

vi.mock('@/components/dsk-workspace/dsk-workspace-utils', () => ({
  generateDskFilenames: mockGenerateDskFilenames
}))

vi.mock('@/export/exports/templates', () => ({
  generateScrDskTemplate: mockGenerateScrDskTemplate,
  generateUniversalScrLoader: mockGenerateUniversalScrLoader
}))

vi.mock('@/export/exports/export-scr/export-scr', () => ({
  exportSCR: mockExportSCR
}))

vi.mock('@/export', () => ({
  injectCPCPlusPaletteIntoSCR: mockInjectCPCPlusPaletteIntoSCR
}))

vi.mock('@/export/exports/cpc-format', () => ({
  injectPaletteDataIntoSCR: mockInjectPaletteDataIntoSCR
}))

vi.mock('@/export/exports/export-linear-asm/export-linear.asm', () => ({
  exportLinearAsm: mockExportLinearAsm,
  splitLinearIntoChunks: mockSplitLinearIntoChunks
}))

vi.mock('@/libs/rasm-wasm', () => ({
  createRasmInstance: mockCreateRasmInstance,
  readDsk: mockReadDsk
}))

// Import after mocks
const { exportDskWorkspace } = await import('./export-dsk-workspace')

describe('exportDskWorkspace', () => {
  const createMockImage = (
    index: number,
    mode: 0 | 1 | 2 = 0,
    overscan = false,
    cpcHardware: CPCHardware = CPCHardware.CLASSIC
  ): DskImage => ({
    id: `image-${index}`,
    name: `Image${index}`,
    scrData: Array.from({ length: 16384 }, () => 0),
    mode,
    width: mode === 0 ? 160 : mode === 1 ? 320 : 640,
    height: 200,
    overscan,
    nColors: mode === 0 ? 16 : mode === 1 ? 4 : 2,
    scaleX: mode === 0 ? 2 : mode === 1 ? 1 : 0.5,
    scaleY: 1.2,
    cpcHardware,
    paletteFirmware: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    palettePlus:
      cpcHardware === CPCHardware.PLUS
        ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        : undefined,
    thumbnailDataUrl: 'data:image/png;base64,test',
    paletteColors: [
      '#000000',
      '#0000ff',
      '#ff0000',
      '#ff00ff',
      '#00ff00',
      '#00ffff',
      '#ffff00',
      '#ffffff',
      '#000080',
      '#8000ff',
      '#800000',
      '#800080',
      '#008000',
      '#008080',
      '#808000',
      '#808080'
    ]
  })

  beforeEach(() => {
    vi.clearAllMocks()

    mockAssembleResult = { success: true }
    mockRasmModule = {
      FS: {
        writeFile: vi.fn(),
        readFile: vi.fn(() => new Uint8Array(184320))
      }
    }
    mockRasmInstance = {
      assemble: vi.fn(async () => mockAssembleResult),
      getModule: vi.fn(() => mockRasmModule)
    }

    // Mock successful fetch
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(184320)
    })
  })

  describe('Basic functionality', () => {
    it('should return null when no images provided', async () => {
      const result = await exportDskWorkspace([])
      expect(result).toBeNull()
    })

    it('should export DSK with single standard mode image', async () => {
      const images = [createMockImage(1, 0)]
      const result = await exportDskWorkspace(images)

      expect(result).not.toBeNull()
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result?.length).toBe(184320)
    })

    it('should export DSK with multiple images', async () => {
      const images = [createMockImage(1, 0), createMockImage(2, 1)]
      const result = await exportDskWorkspace(images)

      expect(result).not.toBeNull()
      expect(result).toBeInstanceOf(Uint8Array)
    })
  })

  describe('Template loading', () => {
    it('should return null when template DSK fails to load', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false
      })

      const images = [createMockImage(1)]
      const result = await exportDskWorkspace(images)

      expect(result).toBeNull()
    })

    it('should load template DSK from public folder', async () => {
      const images = [createMockImage(1)]
      await exportDskWorkspace(images)

      expect(global.fetch).toHaveBeenCalledWith('/pixsaur.dsk')
    })
  })

  describe('Universal loader', () => {
    it('should return null when loader assembly fails', async () => {
      mockAssembleResult = { success: false, output: 'Assembly error' }

      const images = [createMockImage(1)]
      const result = await exportDskWorkspace(images)

      expect(result).toBeNull()
    })

    it('should add universal loader to DSK', async () => {
      const images = [createMockImage(1)]
      await exportDskWorkspace(images)

      expect(mockRasmInstance.assemble).toHaveBeenCalledWith(
        'MOCK_LOADER_CODE',
        expect.objectContaining({
          outputFile: 'loader.bin',
          exportType: 'dsk',
          dskFile: 'pixsaur-workspace.dsk'
        })
      )
    })
  })

  describe('Standard mode images', () => {
    it('should process mode 0 (160x200) as standard', async () => {
      const images = [createMockImage(1, 0)]
      const result = await exportDskWorkspace(images)

      expect(result).not.toBeNull()
      expect(mockRasmModule.FS.writeFile).toHaveBeenCalled()
    })

    it('should process mode 1 (320x200) as standard', async () => {
      const images = [createMockImage(1, 1)]
      const result = await exportDskWorkspace(images)

      expect(result).not.toBeNull()
    })

    it('should process mode 2 (640x200) as standard', async () => {
      const images = [createMockImage(1, 2)]
      const result = await exportDskWorkspace(images)

      expect(result).not.toBeNull()
    })

    it('should inject CPC Plus palette when hardware is plus', async () => {
      const images = [createMockImage(1, 0, false, CPCHardware.PLUS)]
      await exportDskWorkspace(images)

      expect(mockInjectCPCPlusPaletteIntoSCR).toHaveBeenCalled()
    })

    it('should inject firmware palette when hardware is classic', async () => {
      const images = [createMockImage(1, 0, false, CPCHardware.CLASSIC)]
      await exportDskWorkspace(images)

      expect(mockInjectPaletteDataIntoSCR).toHaveBeenCalled()
    })
  })

  describe('Custom dimensions', () => {
    it('should process overscan as custom format', async () => {
      const customImage = createMockImage(1, 0, true)
      const images = [customImage]

      const result = await exportDskWorkspace(images)

      expect(result).not.toBeNull()
    })

    it('should process non-standard dimensions as linear format', async () => {
      const customImage = createMockImage(1, 0)
      customImage.width = 128
      customImage.height = 128
      const images = [customImage]

      const result = await exportDskWorkspace(images)

      expect(result).not.toBeNull()
    })

    it('should split large linear data into chunks', async () => {
      const customImage = createMockImage(1, 0)
      customImage.width = 256
      customImage.height = 256
      const images = [customImage]

      await exportDskWorkspace(images)

      expect(mockSplitLinearIntoChunks).toHaveBeenCalled()
    })
  })

  describe('File operations', () => {
    it('should write template DSK to virtual filesystem', async () => {
      const images = [createMockImage(1)]
      await exportDskWorkspace(images)

      expect(mockRasmModule.FS.writeFile).toHaveBeenCalledWith(
        '/pixsaur-workspace.dsk',
        expect.any(Uint8Array)
      )
    })

    it('should write SCR binary files to virtual filesystem', async () => {
      const images = [createMockImage(1)]
      await exportDskWorkspace(images)

      expect(mockRasmModule.FS.writeFile).toHaveBeenCalledWith(
        '/image1.bin',
        expect.any(Uint8Array)
      )
    })

    it('should generate DSK filenames for each image', async () => {
      const images = [createMockImage(1), createMockImage(2)]
      await exportDskWorkspace(images)

      expect(mockGenerateDskFilenames).toHaveBeenCalledTimes(2)
    })
  })

  describe('Assembly operations', () => {
    it('should assemble SCR files for standard images', async () => {
      const images = [createMockImage(1)]
      await exportDskWorkspace(images)

      // Loader + image
      expect(mockRasmInstance.assemble).toHaveBeenCalledTimes(2)
    })

    it('should handle assembly failures gracefully', async () => {
      let callCount = 0
      mockRasmInstance.assemble = vi.fn(async () => {
        callCount++
        if (callCount === 1) {
          return { success: true } // Loader succeeds
        }
        return { success: false, output: 'SCR assembly failed' } // Image fails
      })

      const images = [createMockImage(1)]
      const result = await exportDskWorkspace(images)

      // Should still return result even if one image fails
      expect(result).not.toBeNull()
    })

    it('should continue processing after chunk assembly failure', async () => {
      const customImage = createMockImage(1, 0)
      customImage.width = 256
      customImage.height = 256

      let callCount = 0
      mockRasmInstance.assemble = vi.fn(async () => {
        callCount++
        if (callCount === 1) {
          return { success: true } // Loader succeeds
        }
        return { success: false, output: 'Chunk assembly failed' }
      })

      const images = [customImage]
      const result = await exportDskWorkspace(images)

      expect(result).not.toBeNull()
    })
  })

  describe('Multiple images processing', () => {
    it('should process all images in order', async () => {
      const images = [
        createMockImage(1, 0),
        createMockImage(2, 1),
        createMockImage(3, 2)
      ]
      await exportDskWorkspace(images)

      expect(mockRasmModule.FS.writeFile).toHaveBeenCalledWith(
        '/image1.bin',
        expect.any(Uint8Array)
      )
      expect(mockRasmModule.FS.writeFile).toHaveBeenCalledWith(
        '/image2.bin',
        expect.any(Uint8Array)
      )
      expect(mockRasmModule.FS.writeFile).toHaveBeenCalledWith(
        '/image3.bin',
        expect.any(Uint8Array)
      )
    })

    it('should handle mix of standard and custom images', async () => {
      const customImage = createMockImage(2, 0)
      customImage.width = 128

      const images = [createMockImage(1, 0), customImage, createMockImage(3, 1)]

      const result = await exportDskWorkspace(images)
      expect(result).not.toBeNull()
    })
  })

  describe('Error handling', () => {
    it('should return null on RASM instance creation error', async () => {
      mockCreateRasmInstance.mockRejectedValueOnce(
        new Error('RASM initialization failed')
      )

      const images = [createMockImage(1)]
      const result = await exportDskWorkspace(images)

      expect(result).toBeNull()
    })

    it('should return null on fetch error', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      const images = [createMockImage(1)]
      const result = await exportDskWorkspace(images)

      expect(result).toBeNull()
    })

    it('should handle readDsk errors', async () => {
      mockReadDsk.mockImplementationOnce(() => {
        throw new Error('Read DSK failed')
      })

      const images = [createMockImage(1)]
      const result = await exportDskWorkspace(images)

      expect(result).toBeNull()
    })
  })

  describe('Logging', () => {
    it('should log start and completion messages', async () => {
      const images = [createMockImage(1)]
      await exportDskWorkspace(images)

      expect(mockDskLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting DSK export')
      )
      expect(mockDskLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully exported DSK')
      )
    })

    it('should log warning when no images', async () => {
      await exportDskWorkspace([])

      expect(mockDskLogger.warn).toHaveBeenCalledWith(
        'No images in workspace to export'
      )
    })

    it('should log errors on failure', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Test error'))

      const images = [createMockImage(1)]
      await exportDskWorkspace(images)

      expect(mockDskLogger.error).toHaveBeenCalledWith(
        'Error during DSK assembly:',
        expect.any(Error)
      )
    })
  })

  describe('Template generation', () => {
    it('should generate SCR DSK template with correct parameters', async () => {
      const images = [createMockImage(1)]
      await exportDskWorkspace(images)

      expect(mockGenerateScrDskTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          scrBinFilename: 'image1.bin',
          scrLabel: 'image1',
          dskFilename: 'pixsaur-workspace.dsk'
        })
      )
    })

    it('should generate universal loader template', async () => {
      const images = [createMockImage(1)]
      await exportDskWorkspace(images)

      expect(mockGenerateUniversalScrLoader).toHaveBeenCalledWith(
        'pixsaur-workspace.dsk'
      )
    })
  })

  describe('Mode config handling', () => {
    it('should create proper mode config for each image', async () => {
      const images = [createMockImage(1, 1)]
      await exportDskWorkspace(images)

      expect(mockExportSCR).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({
          mode: 1,
          width: 320,
          height: 200,
          overscan: false,
          nColors: 4,
          scaleX: 1,
          scaleY: 1.2
        })
      )
    })
  })
})
