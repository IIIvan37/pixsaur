import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CpcModeConfig } from '@/domain/cpc'

// Mock @/core logger
vi.mock('@/core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

// Mock exportSCR
const mockExportSCR = vi.fn()
vi.mock('../export-scr/export-scr', () => ({
  exportSCR: (indexBuf: Uint8Array, modeConfig: CpcModeConfig) =>
    mockExportSCR(indexBuf, modeConfig)
}))

// Mock exportLinearAsm and splitLinearIntoChunks
const mockExportLinearAsm = vi.fn()
const mockSplitLinearIntoChunks = vi.fn()
vi.mock('../export-linear-asm/export-linear.asm', () => ({
  exportLinearAsm: (indexBuf: Uint8Array, modeConfig: CpcModeConfig) =>
    mockExportLinearAsm(indexBuf, modeConfig),
  splitLinearIntoChunks: (data: Uint8Array) => mockSplitLinearIntoChunks(data)
}))

// Mock toASMData
const mockToASMData = vi.fn()
vi.mock('../to-asm-data', () => ({
  toASMData: (data: Uint8Array, label: string) => mockToASMData(data, label)
}))

// Mock RASM
const mockRasmAssemble = vi.fn()
vi.mock('@/libs/rasm-wasm', () => ({
  createRasmInstance: () =>
    Promise.resolve({
      assemble: (source: string, options: object) =>
        mockRasmAssemble(source, options)
    })
}))

describe('export-sna', () => {
  const defaultModeConfig: CpcModeConfig = {
    mode: 0,
    width: 160,
    height: 200,
    overscan: false,
    nColors: 16,
    scaleX: 2,
    scaleY: 1
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockExportSCR.mockReturnValue(new Uint8Array(16384))
    mockToASMData.mockReturnValue('; Test image data')
    mockRasmAssemble.mockResolvedValue({
      success: true,
      snapshot: new Uint8Array([0x4d, 0x56, 0x2d, 0x53, 0x4e, 0x41]),
      output: ''
    })
  })

  describe('generateModeRSnaAsmSource', () => {
    it('should return null when paletteAFirmware is missing for classic hardware', async () => {
      const { generateModeRSnaAsmSource } = await import('./export-sna')

      const result = generateModeRSnaAsmSource({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteBFirmware: [0, 1, 2, 3]
        // paletteAFirmware missing
      })

      expect(result).toBeNull()
    })

    it('should return null when paletteBFirmware is missing for classic hardware', async () => {
      const { generateModeRSnaAsmSource } = await import('./export-sna')

      const result = generateModeRSnaAsmSource({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteAFirmware: [0, 1, 2, 3]
        // paletteBFirmware missing
      })

      expect(result).toBeNull()
    })

    it('should return null when paletteAPlus is missing for plus hardware', async () => {
      const { generateModeRSnaAsmSource } = await import('./export-sna')

      const result = generateModeRSnaAsmSource({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'plus',
        paletteBPlus: [0x000, 0xfff]
        // paletteAPlus missing
      })

      expect(result).toBeNull()
    })

    it('should return null when paletteBPlus is missing for plus hardware', async () => {
      const { generateModeRSnaAsmSource } = await import('./export-sna')

      const result = generateModeRSnaAsmSource({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'plus',
        paletteAPlus: [0x000, 0xfff]
        // paletteBPlus missing
      })

      expect(result).toBeNull()
    })

    it('should return null when Frame A image generation fails', async () => {
      mockToASMData.mockReturnValueOnce(null)

      const { generateModeRSnaAsmSource } = await import('./export-sna')

      const result = generateModeRSnaAsmSource({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteAFirmware: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ],
        paletteBFirmware: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      })

      expect(result).toBeNull()
    })

    it('should return null when Frame B image generation fails', async () => {
      mockToASMData.mockReturnValueOnce('; Frame A data')
      mockToASMData.mockReturnValueOnce(null)

      const { generateModeRSnaAsmSource } = await import('./export-sna')

      const result = generateModeRSnaAsmSource({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteAFirmware: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ],
        paletteBFirmware: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      })

      expect(result).toBeNull()
    })

    it('should generate ASM source for classic hardware', async () => {
      mockToASMData.mockReturnValue('; Image data')

      const { generateModeRSnaAsmSource } = await import('./export-sna')

      const result = generateModeRSnaAsmSource({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteAFirmware: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ],
        paletteBFirmware: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      })

      expect(result).not.toBeNull()
      expect(result).toContain('BUILDSNA')
      expect(result).toContain('ModeR_PaletteA_Hardware')
      expect(result).toContain('ModeR_PaletteB_Hardware')
      expect(result).toContain('org #4000')
      expect(result).toContain('org #c000')
    })

    it('should generate ASM source for plus hardware', async () => {
      mockToASMData.mockReturnValue('; Image data')

      const { generateModeRSnaAsmSource } = await import('./export-sna')

      const result = generateModeRSnaAsmSource({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'plus',
        paletteAPlus: [0x000, 0x111, 0x222, 0x333],
        paletteBPlus: [0xfff, 0xeee, 0xddd, 0xccc]
      })

      expect(result).not.toBeNull()
      expect(result).toContain('BUILDSNA')
      expect(result).toContain('SNASET CPC_TYPE, 4')
      expect(result).toContain('ModeR_PaletteA')
      expect(result).toContain('ModeR_PaletteB')
      expect(result).toContain('Asic_unlock')
      expect(result).toContain('org #4000')
      expect(result).toContain('org #c000')
    })
  })

  describe('exportModeRSna', () => {
    it('should return error when palettes are missing for classic hardware', async () => {
      const { exportModeRSna } = await import('./export-sna')

      const result = await exportModeRSna({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic'
        // palettes missing
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Firmware palettes required')
    })

    it('should return error when palettes are missing for plus hardware', async () => {
      const { exportModeRSna } = await import('./export-sna')

      const result = await exportModeRSna({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'plus'
        // palettes missing
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('CPC Plus palettes required')
    })

    it('should return error when toASMData fails for Frame A', async () => {
      // Simulate toASMData returning an unexpected value
      mockToASMData.mockReturnValueOnce(undefined)

      const { exportModeRSna } = await import('./export-sna')

      const result = await exportModeRSna({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteAFirmware: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ],
        paletteBFirmware: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should return error when toASMData fails for Frame B', async () => {
      // Frame A succeeds, Frame B returns unexpected value
      mockToASMData.mockReturnValueOnce('; Frame A data')
      mockToASMData.mockReturnValueOnce(undefined)

      const { exportModeRSna } = await import('./export-sna')

      const result = await exportModeRSna({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteAFirmware: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ],
        paletteBFirmware: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should return error when RASM assembly fails', async () => {
      mockToASMData.mockReturnValue('; Image data')
      mockRasmAssemble.mockResolvedValue({
        success: false,
        output: 'Syntax error at line 10'
      })

      const { exportModeRSna } = await import('./export-sna')

      const result = await exportModeRSna({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteAFirmware: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ],
        paletteBFirmware: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Assembly failed')
      expect(result.asmSource).toBeDefined()
    })

    it('should return error when no snapshot is generated', async () => {
      mockToASMData.mockReturnValue('; Image data')
      mockRasmAssemble.mockResolvedValue({
        success: true,
        snapshot: undefined,
        output: ''
      })

      const { exportModeRSna } = await import('./export-sna')

      const result = await exportModeRSna({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteAFirmware: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ],
        paletteBFirmware: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No snapshot generated')
    })

    it('should return success with snapshot for classic hardware', async () => {
      mockToASMData.mockReturnValue('; Image data')
      const snapshotData = new Uint8Array([0x4d, 0x56, 0x2d, 0x53, 0x4e, 0x41])
      mockRasmAssemble.mockResolvedValue({
        success: true,
        snapshot: snapshotData,
        output: ''
      })

      const { exportModeRSna } = await import('./export-sna')

      const result = await exportModeRSna({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteAFirmware: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ],
        paletteBFirmware: [
          15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0
        ],
        filename: 'test_mode_r'
      })

      expect(result.success).toBe(true)
      expect(result.snapshot).toEqual(snapshotData)
      expect(result.asmSource).toBeDefined()
    })

    it('should return success with snapshot for plus hardware', async () => {
      mockToASMData.mockReturnValue('; Image data')
      const snapshotData = new Uint8Array([0x4d, 0x56, 0x2d, 0x53, 0x4e, 0x41])
      mockRasmAssemble.mockResolvedValue({
        success: true,
        snapshot: snapshotData,
        output: ''
      })

      const { exportModeRSna } = await import('./export-sna')

      const result = await exportModeRSna({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'plus',
        paletteAPlus: [0x000, 0x111, 0x222, 0x333],
        paletteBPlus: [0xfff, 0xeee, 0xddd, 0xccc],
        filename: 'test_mode_r_plus'
      })

      expect(result.success).toBe(true)
      expect(result.snapshot).toEqual(snapshotData)
      expect(result.asmSource).toBeDefined()
    })

    it('should handle exceptions gracefully', async () => {
      mockToASMData.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const { exportModeRSna } = await import('./export-sna')

      const result = await exportModeRSna({
        indexBufA: new Uint8Array([0, 1, 2, 3]),
        indexBufB: new Uint8Array([4, 5, 6, 7]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteAFirmware: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ],
        paletteBFirmware: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unexpected error')
    })
  })

  // ===========================================================================
  // Standard SCR export (exportSna / generateSnaAsmSource)
  // ===========================================================================

  const fullFirmware = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

  describe('generateSnaAsmSource - standard SCR', () => {
    it('should return null when paletteFirmware is missing for classic', async () => {
      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        hasRasters: false
      })

      expect(result).toBeNull()
    })

    it('should return null when palettePlus is missing for plus', async () => {
      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'plus',
        hasRasters: false
      })

      expect(result).toBeNull()
    })

    it('should return null when SCR image generation fails', async () => {
      mockToASMData.mockReturnValueOnce([])

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result).toBeNull()
    })

    it('should emit classic palette DB bytes mapped via firmwareToHardware', async () => {
      mockToASMData.mockReturnValue('; Image data')

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result).not.toBeNull()
      expect(result).toContain('Palette_Hardware:')
      // firmware 0 -> 0x54, firmware 13 -> 0x40
      expect(result).toContain(
        '#54,#44,#55,#5C,#58,#5D,#4C,#45,#4D,#56,#46,#57,#5E,#40,#5F,#4E'
      )
    })

    it('should place SCR image at org #c000 (standard, not overscan)', async () => {
      mockToASMData.mockReturnValue('; Image data')

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result).toContain('; === IMAGE DATA ===')
      expect(result).toContain('org #c000')
      expect(result).not.toContain('org #4268')
    })

    it('should emit mode 0 gate-array register #7c8C', async () => {
      mockToASMData.mockReturnValue('; Image data')

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: { ...defaultModeConfig, mode: 0 },
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result).toContain('#7c8C')
    })

    it('should emit mode 1 gate-array register #7c8D', async () => {
      mockToASMData.mockReturnValue('; Image data')

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: {
          mode: 1,
          width: 320,
          height: 200,
          overscan: false,
          nColors: 4,
          scaleX: 1,
          scaleY: 1
        },
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result).toContain('#7c8D')
    })

    it('should emit mode 2 gate-array register #7c8E', async () => {
      mockToASMData.mockReturnValue('; Image data')

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: {
          mode: 2,
          width: 640,
          height: 200,
          overscan: false,
          nColors: 2,
          scaleX: 1,
          scaleY: 1
        },
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result).toContain('#7c8E')
    })

    it('should emit plus DEFW palette and CPC_TYPE 4 for plus hardware', async () => {
      mockToASMData.mockReturnValue('; Image data')

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'plus',
        palettePlus: [0x000, 0xfff, 0x123],
        hasRasters: false
      })

      expect(result).not.toBeNull()
      expect(result).toContain('SNASET CPC_TYPE, 4')
      expect(result).toContain('Palette:')
      expect(result).toContain('DEFW')
      // 0x000 -> #0000, 0xfff -> #0FFF, 0x123 -> #0123
      expect(result).toContain('#0000, #0FFF, #0123')
      expect(result).toContain('Asic_unlock')
    })

    it('should include raster data section when hasRasters is true', async () => {
      mockToASMData.mockReturnValue('; Image data')

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        rasterAsm: 'RasterData:\n    DB #00',
        hasRasters: true
      })

      expect(result).toContain('; === RASTER DATA ===')
      expect(result).toContain('RasterData:')
      expect(result).toContain('jmp_table')
    })

    it('should return null on unexpected exception', async () => {
      mockToASMData.mockImplementation(() => {
        throw new Error('boom')
      })

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result).toBeNull()
    })
  })

  describe('generateSnaAsmSource - overscan', () => {
    const overscanConfig: CpcModeConfig = {
      mode: 0,
      width: 192,
      height: 272,
      overscan: true,
      nColors: 16,
      scaleX: 2,
      scaleY: 1
    }

    beforeEach(() => {
      mockExportLinearAsm.mockReturnValue(new Uint8Array(100))
      mockSplitLinearIntoChunks.mockReturnValue([
        { data: new Uint8Array(50), index: 1 }
      ])
    })

    it('should return null when linear image generation yields no chunks', async () => {
      mockSplitLinearIntoChunks.mockReturnValue([])

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: overscanConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result).toBeNull()
    })

    it('should place image at org #4268 and program at org #b000', async () => {
      mockToASMData.mockReturnValue('; chunk data')

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: overscanConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result).not.toBeNull()
      expect(result).toContain('org #4268')
      expect(result).toContain('org #b000')
      expect(result).not.toContain('org #c000')
    })

    it('should append second chunk when linear data spans two chunks', async () => {
      mockSplitLinearIntoChunks.mockReturnValue([
        { data: new Uint8Array(50), index: 1 },
        { data: new Uint8Array(50), index: 2 }
      ])
      mockToASMData.mockReturnValueOnce('; chunk0 data')
      mockToASMData.mockReturnValueOnce('; chunk1 data')

      const { generateSnaAsmSource } = await import('./export-sna')

      const result = generateSnaAsmSource({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: overscanConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result).toContain('; chunk0 data')
      expect(result).toContain('; chunk1 data')
    })
  })

  describe('exportSna', () => {
    beforeEach(() => {
      mockToASMData.mockReturnValue('; Image data')
    })

    it('should return error when firmware palette missing for classic', async () => {
      const { exportSna } = await import('./export-sna')

      const result = await exportSna({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        hasRasters: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Firmware palette required')
    })

    it('should return error when plus palette missing for plus', async () => {
      const { exportSna } = await import('./export-sna')

      const result = await exportSna({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'plus',
        hasRasters: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('CPC Plus palette required')
    })

    it('should return error when SCR image generation fails', async () => {
      // toASMData returns an empty chunk array -> [0]?.content is null
      mockToASMData.mockReturnValue([])

      const { exportSna } = await import('./export-sna')

      const result = await exportSna({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to generate SCR image data')
    })

    it('should return error when linear image generation fails (overscan)', async () => {
      mockExportLinearAsm.mockReturnValue(new Uint8Array(100))
      mockSplitLinearIntoChunks.mockReturnValue([])

      const { exportSna } = await import('./export-sna')

      const result = await exportSna({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: {
          mode: 0,
          width: 192,
          height: 272,
          overscan: true,
          nColors: 16,
          scaleX: 2,
          scaleY: 1
        },
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to generate linear image data')
    })

    it('should return error when RASM assembly fails', async () => {
      mockRasmAssemble.mockResolvedValue({
        success: false,
        output: 'bad opcode'
      })

      const { exportSna } = await import('./export-sna')

      const result = await exportSna({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Assembly failed')
      expect(result.asmSource).toBeDefined()
    })

    it('should return error when no snapshot is generated', async () => {
      mockRasmAssemble.mockResolvedValue({
        success: true,
        snapshot: undefined,
        output: ''
      })

      const { exportSna } = await import('./export-sna')

      const result = await exportSna({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No snapshot generated')
    })

    it('should return success with snapshot for classic standard', async () => {
      const snapshotData = new Uint8Array([
        0x4d, 0x56, 0x20, 0x2d, 0x20, 0x53, 0x4e, 0x41
      ])
      mockRasmAssemble.mockResolvedValue({
        success: true,
        snapshot: snapshotData,
        output: ''
      })

      const { exportSna } = await import('./export-sna')

      const result = await exportSna({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false,
        filename: 'my_export'
      })

      expect(result.success).toBe(true)
      expect(result.snapshot).toEqual(snapshotData)
      expect(result.asmSource).toContain('Palette_Hardware:')
    })

    it('should pass filename through to RASM assemble options', async () => {
      mockRasmAssemble.mockResolvedValue({
        success: true,
        snapshot: new Uint8Array([1, 2, 3]),
        output: ''
      })

      const { exportSna } = await import('./export-sna')

      await exportSna({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false,
        filename: 'custom_name'
      })

      const [, opts] = mockRasmAssemble.mock.calls[0]
      expect(opts).toMatchObject({
        outputFile: 'custom_name.bin',
        exportType: 'snapshot',
        snapshotFile: 'custom_name.sna'
      })
    })

    it('should return success for plus hardware', async () => {
      mockRasmAssemble.mockResolvedValue({
        success: true,
        snapshot: new Uint8Array([0x4d, 0x56]),
        output: ''
      })

      const { exportSna } = await import('./export-sna')

      const result = await exportSna({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'plus',
        palettePlus: [0x000, 0xfff],
        hasRasters: false
      })

      expect(result.success).toBe(true)
      expect(result.asmSource).toContain('SNASET CPC_TYPE, 4')
    })

    it('should handle exceptions gracefully', async () => {
      mockToASMData.mockImplementation(() => {
        throw new Error('kaboom')
      })

      const { exportSna } = await import('./export-sna')

      const result = await exportSna({
        indexBuf: new Uint8Array([0, 1, 2, 3]),
        modeConfig: defaultModeConfig,
        hardware: 'classic',
        paletteFirmware: fullFirmware,
        hasRasters: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('kaboom')
    })
  })
})
