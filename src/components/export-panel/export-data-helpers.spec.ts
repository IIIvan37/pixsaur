import { describe, expect, it, vi } from 'vitest'
import { IGNORED_SLOT, type IndexBufferData } from '@/app/store/preview/preview'
import {
  convertPaletteToCPCPlus,
  convertPaletteToFirmware,
  type GetExportDataParams,
  isIgnoredSlot,
  prepareExportData
} from './export-data-helpers'

// Mock the export functions
vi.mock('@/export', () => ({
  rgbToFirmwareIndex: vi.fn((r: number, g: number, b: number) => {
    // Simple mock: return sum of components mod 27 (CPC Classic has 27 colors)
    return (r + g + b) % 27
  }),
  rgbToCPCPlus: vi.fn((r: number, g: number, b: number) => {
    // Mock: return a 12-bit value
    return ((g & 0xf0) << 4) | (r & 0xf0) | ((b & 0xf0) >> 4)
  })
}))

describe('isIgnoredSlot', () => {
  it('returns true for IGNORED_SLOT color', () => {
    expect(isIgnoredSlot([...IGNORED_SLOT])).toBe(true)
  })

  it('returns false for black', () => {
    expect(isIgnoredSlot([0, 0, 0])).toBe(false)
  })

  it('returns false for white', () => {
    expect(isIgnoredSlot([255, 255, 255])).toBe(false)
  })

  it('returns false for regular colors', () => {
    expect(isIgnoredSlot([255, 0, 0])).toBe(false)
    expect(isIgnoredSlot([0, 255, 0])).toBe(false)
    expect(isIgnoredSlot([0, 0, 255])).toBe(false)
  })
})

describe('convertPaletteToFirmware', () => {
  it('converts palette colors to firmware indices', () => {
    const palette = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ]
    const result = convertPaletteToFirmware(palette, false)
    expect(result).toHaveLength(3)
    expect(result.every((v) => typeof v === 'number')).toBe(true)
  })

  it('handles ignored slots when not using raster palette', () => {
    const palette = [[...IGNORED_SLOT], [255, 0, 0]]
    const result = convertPaletteToFirmware(palette, false)
    expect(result[0]).toBe(0) // Ignored slot returns 0
  })

  it('does not treat ignored slots specially when using raster palette', () => {
    const palette = [[...IGNORED_SLOT], [255, 0, 0]]
    const result = convertPaletteToFirmware(palette, true)
    // With raster palette, ignored check is skipped
    expect(result).toHaveLength(2)
  })

  it('handles Uint8ClampedArray-like objects', () => {
    const palette = [
      new Uint8ClampedArray([255, 0, 0]),
      new Uint8ClampedArray([0, 255, 0])
    ]
    const result = convertPaletteToFirmware(palette, false)
    expect(result).toHaveLength(2)
  })
})

describe('convertPaletteToCPCPlus', () => {
  it('converts palette colors to 12-bit format', () => {
    const palette = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ]
    const result = convertPaletteToCPCPlus(palette)
    expect(result).toHaveLength(3)
    expect(result.every((v) => typeof v === 'number')).toBe(true)
  })

  it('handles ignored slots', () => {
    const palette = [[...IGNORED_SLOT], [255, 0, 0]]
    const result = convertPaletteToCPCPlus(palette)
    expect(result[0]).toBe(0) // Ignored slot returns 0
  })

  it('handles empty palette', () => {
    const result = convertPaletteToCPCPlus([])
    expect(result).toHaveLength(0)
  })
})

describe('prepareExportData', () => {
  const createMockIndexBufferData = (
    width = 2,
    height = 2
  ): IndexBufferData => {
    const buffer = new Uint8Array([0, 1, 2, 0])
    const palette = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ] as [number, number, number][]
    return { buffer, width, height, palette }
  }

  const basePalette = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255]
  ]

  it('returns null when finalPreviewIndexBuffer is null', () => {
    const params: GetExportDataParams = {
      finalPreviewIndexBuffer: null,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: null,
      finalRasterIndexBuffer: null,
      cpcHardware: 'classic'
    }
    expect(prepareExportData(params)).toBeNull()
  })

  it('returns null when finalPreviewIndexBuffer is undefined', () => {
    const params: GetExportDataParams = {
      finalPreviewIndexBuffer: undefined,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: null,
      finalRasterIndexBuffer: null,
      cpcHardware: 'classic'
    }
    expect(prepareExportData(params)).toBeNull()
  })

  it('returns export data for CPC Classic without raster', () => {
    const indexBuffer = createMockIndexBufferData()
    const params: GetExportDataParams = {
      finalPreviewIndexBuffer: indexBuffer,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: null,
      finalRasterIndexBuffer: null,
      cpcHardware: 'classic'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    expect(result!.paletteFirmware).toHaveLength(3)
    expect(result!.palettePlus).toHaveLength(0)
    expect(result!.indexBuf).toBe(indexBuffer.buffer)
    expect(result!.cleanImage.width).toBe(2)
    expect(result!.cleanImage.height).toBe(2)
  })

  it('returns export data for CPC Plus without raster', () => {
    const indexBuffer = createMockIndexBufferData()
    const params: GetExportDataParams = {
      finalPreviewIndexBuffer: indexBuffer,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: null,
      finalRasterIndexBuffer: null,
      cpcHardware: 'plus'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    expect(result!.paletteFirmware).toHaveLength(0)
    expect(result!.palettePlus).toHaveLength(3)
    expect(result!.indexBuf).toBeInstanceOf(Uint8Array)
  })

  it('uses raster palette when raster is enabled', () => {
    const indexBuffer = createMockIndexBufferData()
    const rasterPalette = [
      [128, 128, 128],
      [64, 64, 64]
    ]
    const params: GetExportDataParams = {
      finalPreviewIndexBuffer: indexBuffer,
      exportPalette: basePalette,
      rasterEnabled: true,
      rasterBasePalette: rasterPalette,
      finalRasterIndexBuffer: null,
      cpcHardware: 'classic'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    expect(result!.effectivePalette).toBe(rasterPalette)
    expect(result!.paletteFirmware).toHaveLength(2) // Uses raster palette length
  })

  it('uses raster index buffer when available', () => {
    const previewBuffer = createMockIndexBufferData()
    const rasterPalette = [[128, 128, 128]]
    const rasterBuffer: IndexBufferData = {
      buffer: new Uint8Array([5, 6, 7, 8]),
      width: 2,
      height: 2,
      palette: [[128, 128, 128]]
    }
    const params: GetExportDataParams = {
      finalPreviewIndexBuffer: previewBuffer,
      exportPalette: basePalette,
      rasterEnabled: true,
      rasterBasePalette: rasterPalette,
      finalRasterIndexBuffer: rasterBuffer,
      cpcHardware: 'classic'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    expect(result!.indexBuf).toBe(rasterBuffer.buffer)
  })

  it('falls back to export palette when raster is disabled', () => {
    const indexBuffer = createMockIndexBufferData()
    const rasterPalette = [[128, 128, 128]]
    const rasterBuffer: IndexBufferData = {
      buffer: new Uint8Array([5, 6, 7, 8]),
      width: 2,
      height: 2,
      palette: [[128, 128, 128]]
    }
    const params: GetExportDataParams = {
      finalPreviewIndexBuffer: indexBuffer,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: rasterPalette,
      finalRasterIndexBuffer: rasterBuffer,
      cpcHardware: 'classic'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    expect(result!.effectivePalette).toBe(basePalette)
  })

  it('generates correct ImageData from index buffer', () => {
    const indexBuffer: IndexBufferData = {
      buffer: new Uint8Array([0, 1, 0, 1]),
      width: 2,
      height: 2,
      palette: [
        [255, 0, 0],
        [0, 255, 0]
      ]
    }
    const params: GetExportDataParams = {
      finalPreviewIndexBuffer: indexBuffer,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: null,
      finalRasterIndexBuffer: null,
      cpcHardware: 'classic'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    const { cleanImage } = result!
    expect(cleanImage.width).toBe(2)
    expect(cleanImage.height).toBe(2)
    // First pixel: red (index 0)
    expect(cleanImage.data[0]).toBe(255) // R
    expect(cleanImage.data[1]).toBe(0) // G
    expect(cleanImage.data[2]).toBe(0) // B
    expect(cleanImage.data[3]).toBe(255) // A
    // Second pixel: green (index 1)
    expect(cleanImage.data[4]).toBe(0) // R
    expect(cleanImage.data[5]).toBe(255) // G
    expect(cleanImage.data[6]).toBe(0) // B
    expect(cleanImage.data[7]).toBe(255) // A
  })

  describe('manual edits support', () => {
    it('uses finalPreviewIndexBuffer which includes manual edits', () => {
      // This test validates that export uses the FINAL buffer (with edits applied)
      // not the raw preview buffer
      const editedBuffer: IndexBufferData = {
        buffer: new Uint8Array([3, 3, 3, 3]), // Edited values
        width: 2,
        height: 2,
        palette: [
          [0, 0, 0],
          [255, 0, 0],
          [0, 255, 0],
          [0, 0, 255]
        ]
      }
      const params: GetExportDataParams = {
        finalPreviewIndexBuffer: editedBuffer,
        exportPalette: basePalette,
        rasterEnabled: false,
        rasterBasePalette: null,
        finalRasterIndexBuffer: null,
        cpcHardware: 'classic'
      }

      const result = prepareExportData(params)

      expect(result).not.toBeNull()
      // The export should use the edited buffer values
      expect(result!.indexBuf).toBe(editedBuffer.buffer)
      expect(Array.from(result!.indexBuf)).toEqual([3, 3, 3, 3])
    })

    it('uses finalRasterIndexBuffer with manual edits in raster mode', () => {
      const previewBuffer = createMockIndexBufferData()
      const rasterPalette = [
        [128, 0, 0],
        [0, 128, 0],
        [0, 0, 128],
        [128, 128, 0]
      ]
      // Raster buffer with edits already applied
      const editedRasterBuffer: IndexBufferData = {
        buffer: new Uint8Array([2, 2, 2, 2]), // Edited raster values
        width: 2,
        height: 2,
        palette: rasterPalette as [number, number, number][]
      }
      const params: GetExportDataParams = {
        finalPreviewIndexBuffer: previewBuffer,
        exportPalette: basePalette,
        rasterEnabled: true,
        rasterBasePalette: rasterPalette,
        finalRasterIndexBuffer: editedRasterBuffer,
        cpcHardware: 'classic'
      }

      const result = prepareExportData(params)

      expect(result).not.toBeNull()
      // Should use the raster buffer with edits, not preview buffer
      expect(result!.indexBuf).toBe(editedRasterBuffer.buffer)
      expect(Array.from(result!.indexBuf)).toEqual([2, 2, 2, 2])
    })

    it('cleanImage reflects manual edits from index buffer', () => {
      // Buffer where pixel at (0,0) was manually changed to blue (index 2)
      const editedBuffer: IndexBufferData = {
        buffer: new Uint8Array([2, 0, 0, 0]), // First pixel edited to index 2
        width: 2,
        height: 2,
        palette: [
          [255, 0, 0], // ink 0 = red
          [0, 255, 0], // ink 1 = green
          [0, 0, 255] // ink 2 = blue
        ]
      }
      const params: GetExportDataParams = {
        finalPreviewIndexBuffer: editedBuffer,
        exportPalette: basePalette,
        rasterEnabled: false,
        rasterBasePalette: null,
        finalRasterIndexBuffer: null,
        cpcHardware: 'classic'
      }

      const result = prepareExportData(params)

      expect(result).not.toBeNull()
      const { cleanImage } = result!
      // First pixel should be blue (the edited value)
      expect(cleanImage.data[0]).toBe(0) // R
      expect(cleanImage.data[1]).toBe(0) // G
      expect(cleanImage.data[2]).toBe(255) // B
      expect(cleanImage.data[3]).toBe(255) // A
    })

    it('export for CPC Playground uses correct index buffer with edits', () => {
      const editedBuffer: IndexBufferData = {
        buffer: new Uint8Array([1, 2, 3, 0]),
        width: 2,
        height: 2,
        palette: [
          [0, 0, 0],
          [255, 0, 0],
          [0, 255, 0],
          [0, 0, 255]
        ]
      }
      const params: GetExportDataParams = {
        finalPreviewIndexBuffer: editedBuffer,
        exportPalette: basePalette,
        rasterEnabled: false,
        rasterBasePalette: null,
        finalRasterIndexBuffer: null,
        cpcHardware: 'plus'
      }

      const result = prepareExportData(params)

      expect(result).not.toBeNull()
      // CPC Playground needs indexBuf with manual edits
      expect(result!.indexBuf).toBeInstanceOf(Uint8Array)
      expect(Array.from(result!.indexBuf)).toEqual([1, 2, 3, 0])
      // Should have CPC Plus palette
      expect(result!.palettePlus.length).toBeGreaterThan(0)
    })
  })
})
