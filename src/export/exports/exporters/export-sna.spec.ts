import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CpcModeConfig } from '@/app/store/config/types'

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
})
