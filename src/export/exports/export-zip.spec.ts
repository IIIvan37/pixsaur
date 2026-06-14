import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CpcModeConfig } from '@/domain/cpc'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { buildExportZipBlob } from './export-zip'
import type { ExportConfig } from './types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const MODE0_STANDARD: CpcModeConfig = {
  overscan: false,
  mode: 0,
  width: 160,
  height: 200,
  nColors: 16,
  scaleX: 2,
  scaleY: 1
}

const MODE1_STANDARD: CpcModeConfig = {
  overscan: false,
  mode: 1,
  width: 320,
  height: 200,
  nColors: 4,
  scaleX: 1,
  scaleY: 1
}

// A 16-firmware-index palette (valid indices 0..26)
function makeFirmwarePalette(): number[] {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
}

// A 16-entry RGB palette for CPC Plus exports
function makeRgbPalette(): Array<[number, number, number]> {
  return Array.from(
    { length: 16 },
    (_, i) => [i * 16, i * 8, i * 4] as [number, number, number]
  )
}

// Index buffer sized for the given mode config (one byte per pixel)
function makeIndexBuf(modeConfig: CpcModeConfig): Uint8Array {
  const buf = new Uint8Array(modeConfig.width * modeConfig.height)
  for (let i = 0; i < buf.length; i++) {
    buf[i] = i % modeConfig.nColors
  }
  return buf
}

// Minimal canvas stub. getImageData returns valid ImageData unless `nullCtx`.
function makeCanvas(
  width: number,
  height: number,
  opts: { nullCtx?: boolean } = {}
): HTMLCanvasElement {
  const imageData = {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
    colorSpace: 'srgb' as const
  } as ImageData

  return {
    width,
    height,
    getContext: vi.fn(() =>
      opts.nullCtx
        ? null
        : {
            getImageData: vi.fn(() => imageData),
            putImageData: vi.fn(),
            drawImage: vi.fn(),
            fillRect: vi.fn(),
            fillStyle: '',
            imageSmoothingEnabled: true
          }
    )
  } as unknown as HTMLCanvasElement
}

// Build a full ExportConfig from a partial content selection. Everything is
// off by default so each test enables only what it asserts on.
function makeConfig(
  content: Partial<ExportConfig['content']>,
  overrides: Partial<Omit<ExportConfig, 'content'>> = {}
): ExportConfig {
  return {
    content: {
      includeSCR: false,
      includeLinear: false,
      includePalettes: false,
      includePNG: false,
      includePNGCorrected: false,
      includeRasters: false,
      includeSNA: false,
      ...content
    },
    labels: {
      enabled: true,
      media: 'pixsaur_data',
      palette: 'Palette',
      raster: 'RasterData'
    },
    filename: 'pixsaur',
    ...overrides
  }
}

// Re-read the zip blob produced by buildExportZipBlob to inspect entries.
async function entriesOf(blob: Blob | null): Promise<string[]> {
  expect(blob).not.toBeNull()
  const zip = await JSZip.loadAsync(blob as Blob)
  return Object.keys(zip.files).sort()
}

// In the non-EGX classic/plus paths the palette ASM files are written
// unconditionally (the dedicated palette exporters ignore the content flag),
// so they are always present in the archive.
const CLASSIC_PALETTE_FILES = ['palette_firmware.asm', 'palette_hardware.asm']
const PLUS_PALETTE_FILES = ['palette_plus.asm']

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildExportZipBlob', () => {
  it('returns null when the canvas pixels cannot be read back', async () => {
    const result = await buildExportZipBlob({
      indexBuf: makeIndexBuf(MODE0_STANDARD),
      paletteFirmware: makeFirmwarePalette(),
      canvas: makeCanvas(160, 200, { nullCtx: true }),
      modeConfig: MODE0_STANDARD,
      cpcHardware: 'classic',
      reducedPalette: undefined,
      config: makeConfig({})
    })

    expect(result).toBeNull()
  })

  it('returns a Blob for minimal valid input with nothing enabled', async () => {
    const blob = await buildExportZipBlob({
      indexBuf: makeIndexBuf(MODE0_STANDARD),
      paletteFirmware: makeFirmwarePalette(),
      canvas: makeCanvas(160, 200),
      modeConfig: MODE0_STANDARD,
      cpcHardware: 'classic',
      reducedPalette: undefined,
      config: makeConfig({})
    })

    expect(blob).toBeInstanceOf(Blob)
    // No selectable formats enabled, but the classic palette files are always
    // emitted by the dedicated palette exporters (they ignore the flag).
    expect(await entriesOf(blob)).toEqual(CLASSIC_PALETTE_FILES)
  })

  describe('CPC Classic', () => {
    it('includes the SCR ASM file under the configured media label', async () => {
      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'classic',
        reducedPalette: undefined,
        config: makeConfig(
          { includeSCR: true },
          {
            labels: {
              enabled: true,
              media: 'MyImage',
              palette: 'Palette',
              raster: 'RasterData'
            }
          }
        )
      })

      expect(await entriesOf(blob)).toEqual([
        'MyImage.asm',
        ...CLASSIC_PALETTE_FILES
      ])
    })

    it('uses the default media label when labels are disabled', async () => {
      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'classic',
        reducedPalette: undefined,
        config: makeConfig(
          { includeSCR: true },
          {
            labels: {
              enabled: false,
              media: 'IGNORED',
              palette: 'Palette',
              raster: 'RasterData'
            }
          }
        )
      })

      expect(await entriesOf(blob)).toEqual([
        ...CLASSIC_PALETTE_FILES,
        'pixsaur_data.asm'
      ])
    })

    it('includes the linear ASM file when includeLinear is enabled', async () => {
      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'classic',
        reducedPalette: undefined,
        config: makeConfig({ includeLinear: true })
      })

      expect(await entriesOf(blob)).toEqual([
        ...CLASSIC_PALETTE_FILES,
        'pixsaur_data_linear.asm'
      ])
    })

    it('always emits both classic palette files in the standard path', async () => {
      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'classic',
        reducedPalette: undefined,
        config: makeConfig({ includePalettes: true })
      })

      expect(await entriesOf(blob)).toEqual(CLASSIC_PALETTE_FILES)
    })

    it('does not include a raster file when there are no raster changes', async () => {
      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'classic',
        reducedPalette: undefined,
        config: makeConfig({ includeRasters: true }),
        rasterChanges: []
      })

      expect(await entriesOf(blob)).toEqual(CLASSIC_PALETTE_FILES)
    })

    it('includes rasters.asm when raster changes exist and rasters are enabled', async () => {
      const rasterChanges: RasterChange[] = [
        { id: 'r1', line: 10, inkIndex: 1, color: [255, 0, 0] }
      ]

      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'classic',
        reducedPalette: undefined,
        config: makeConfig({ includeRasters: true }),
        rasterChanges
      })

      expect(await entriesOf(blob)).toEqual([
        ...CLASSIC_PALETTE_FILES,
        'rasters.asm'
      ])
    })

    it('omits rasters.asm when raster changes exist but rasters are disabled', async () => {
      const rasterChanges: RasterChange[] = [
        { id: 'r1', line: 10, inkIndex: 1, color: [255, 0, 0] }
      ]

      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'classic',
        reducedPalette: undefined,
        config: makeConfig({ includeRasters: false }),
        rasterChanges
      })

      // rasters.asm omitted; only the always-present palette files remain.
      expect(await entriesOf(blob)).toEqual(CLASSIC_PALETTE_FILES)
    })

    it('bundles SCR, linear and palette files together when all enabled', async () => {
      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE1_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(320, 200),
        modeConfig: MODE1_STANDARD,
        cpcHardware: 'classic',
        reducedPalette: undefined,
        config: makeConfig({
          includeSCR: true,
          includeLinear: true,
          includePalettes: true
        })
      })

      expect(await entriesOf(blob)).toEqual([
        ...CLASSIC_PALETTE_FILES,
        'pixsaur_data.asm',
        'pixsaur_data_linear.asm'
      ])
    })
  })

  describe('CPC Plus', () => {
    it('throws when reducedPalette is missing for a Plus export', async () => {
      await expect(
        buildExportZipBlob({
          indexBuf: makeIndexBuf(MODE0_STANDARD),
          paletteFirmware: makeFirmwarePalette(),
          canvas: makeCanvas(160, 200),
          modeConfig: MODE0_STANDARD,
          cpcHardware: 'plus',
          reducedPalette: undefined,
          config: makeConfig({ includeSCR: true })
        })
      ).rejects.toThrow('Reduced palette is required for CPC Plus export')
    })

    it('includes the Plus SCR ASM file when includeSCR is enabled', async () => {
      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'plus',
        reducedPalette: makeRgbPalette(),
        config: makeConfig({ includeSCR: true })
      })

      expect(await entriesOf(blob)).toEqual([
        ...PLUS_PALETTE_FILES,
        'pixsaur_data.asm'
      ])
    })

    it('always emits the Plus palette file in the standard path', async () => {
      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'plus',
        reducedPalette: makeRgbPalette(),
        config: makeConfig({ includePalettes: true })
      })

      expect(await entriesOf(blob)).toEqual(PLUS_PALETTE_FILES)
    })

    it('produces the linear ASM file for Plus exports', async () => {
      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'plus',
        reducedPalette: makeRgbPalette(),
        config: makeConfig({ includeLinear: true })
      })

      expect(await entriesOf(blob)).toEqual([
        ...PLUS_PALETTE_FILES,
        'pixsaur_data_linear.asm'
      ])
    })
  })

  describe('PNG export', () => {
    it('adds the square-pixel PNG when includePNG is enabled', async () => {
      // export-png creates its own canvases via document.createElement and
      // relies on canvas.toBlob, which happy-dom does not implement — stub it.
      vi.spyOn(document, 'createElement').mockImplementation(
        (tagName: string) => {
          if (tagName === 'canvas') {
            return {
              width: 0,
              height: 0,
              getContext: () => ({
                putImageData: vi.fn(),
                drawImage: vi.fn(),
                fillRect: vi.fn(),
                fillStyle: '',
                imageSmoothingEnabled: true
              }),
              toBlob: (cb: (b: Blob) => void) =>
                cb(new Blob(['png'], { type: 'image/png' }))
            } as unknown as HTMLCanvasElement
          }
          return null as unknown as HTMLElement
        }
      )

      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'classic',
        reducedPalette: undefined,
        config: makeConfig({ includePNG: true })
      })

      expect(await entriesOf(blob)).toEqual([
        ...CLASSIC_PALETTE_FILES,
        'pixsaur.png'
      ])
    })
  })

  describe('filename handling', () => {
    it('names the SCR ASM after the media label, independent of config.filename', async () => {
      // For a standard non-EGX classic export the SCR ASM file is named after
      // the media label, not config.filename. Verify config.filename does not
      // leak into the SCR ASM entry name.
      const blob = await buildExportZipBlob({
        indexBuf: makeIndexBuf(MODE0_STANDARD),
        paletteFirmware: makeFirmwarePalette(),
        canvas: makeCanvas(160, 200),
        modeConfig: MODE0_STANDARD,
        cpcHardware: 'classic',
        reducedPalette: undefined,
        config: makeConfig({ includeSCR: true }, { filename: 'my_project' })
      })

      const entries = await entriesOf(blob)
      expect(entries).toContain('pixsaur_data.asm')
      expect(entries).not.toContain('my_project.asm')
    })
  })
})
