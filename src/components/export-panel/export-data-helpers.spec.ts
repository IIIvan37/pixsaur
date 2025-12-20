import { describe, expect, it, vi } from 'vitest'
import { IGNORED_SLOT } from '@/app/store/preview/preview'
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
  }),
  rgbToIndexBufferExact: vi.fn(
    (
      _data: Uint8ClampedArray,
      _palette: unknown[],
      _flag: boolean,
      _isCPCPlus?: boolean
    ) => {
      return new Uint8Array([0, 1, 2, 3])
    }
  )
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
  const createMockImageData = (width = 4, height = 4): ImageData => {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 // R
      data[i + 1] = 0 // G
      data[i + 2] = 0 // B
      data[i + 3] = 255 // A
    }
    return { data, width, height, colorSpace: 'srgb' } as ImageData
  }

  const basePalette = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255]
  ]

  it('returns null when image is null', () => {
    const params: GetExportDataParams = {
      image: null,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: null,
      rasterIndexBuffer: null,
      cpcHardware: 'classic'
    }
    expect(prepareExportData(params)).toBeNull()
  })

  it('returns null when image has no data', () => {
    const params: GetExportDataParams = {
      image: undefined,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: null,
      rasterIndexBuffer: null,
      cpcHardware: 'classic'
    }
    expect(prepareExportData(params)).toBeNull()
  })

  it('returns export data for CPC Classic without raster', () => {
    const image = createMockImageData()
    const params: GetExportDataParams = {
      image,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: null,
      rasterIndexBuffer: null,
      cpcHardware: 'classic'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    expect(result!.paletteFirmware).toHaveLength(3)
    expect(result!.palettePlus).toHaveLength(0)
    expect(result!.indexBuf).toBeInstanceOf(Uint8Array)
    expect(result!.cleanImage).toBe(image)
  })

  it('returns export data for CPC Plus without raster', () => {
    const image = createMockImageData()
    const params: GetExportDataParams = {
      image,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: null,
      rasterIndexBuffer: null,
      cpcHardware: 'plus'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    expect(result!.paletteFirmware).toHaveLength(0)
    expect(result!.palettePlus).toHaveLength(3)
    expect(result!.indexBuf).toBeInstanceOf(Uint8Array)
  })

  it('uses raster palette when raster is enabled', () => {
    const image = createMockImageData()
    const rasterPalette = [
      [128, 128, 128],
      [64, 64, 64]
    ]
    const params: GetExportDataParams = {
      image,
      exportPalette: basePalette,
      rasterEnabled: true,
      rasterBasePalette: rasterPalette,
      rasterIndexBuffer: null,
      cpcHardware: 'classic'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    expect(result!.effectivePalette).toBe(rasterPalette)
    expect(result!.paletteFirmware).toHaveLength(2) // Uses raster palette length
  })

  it('uses raster index buffer when available', () => {
    const image = createMockImageData()
    const rasterPalette = [[128, 128, 128]]
    const rasterBuffer = new Uint8Array([5, 6, 7, 8])
    const params: GetExportDataParams = {
      image,
      exportPalette: basePalette,
      rasterEnabled: true,
      rasterBasePalette: rasterPalette,
      rasterIndexBuffer: { buffer: rasterBuffer },
      cpcHardware: 'classic'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    expect(result!.indexBuf).toBe(rasterBuffer)
  })

  it('falls back to export palette when raster is disabled', () => {
    const image = createMockImageData()
    const rasterPalette = [[128, 128, 128]]
    const params: GetExportDataParams = {
      image,
      exportPalette: basePalette,
      rasterEnabled: false,
      rasterBasePalette: rasterPalette,
      rasterIndexBuffer: { buffer: new Uint8Array([5, 6, 7, 8]) },
      cpcHardware: 'classic'
    }

    const result = prepareExportData(params)

    expect(result).not.toBeNull()
    expect(result!.effectivePalette).toBe(basePalette)
  })
})
