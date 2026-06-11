import type { CpcModeConfig } from '@/app/store/config/types'
import { DEFAULT_EGX_CONFIG } from '@/libs/pixsaur-egx'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { CPCHardware } from '@/libs/types'
import { paletteToCPCPlusValues } from '../exports/cpc-plus-format'
import type { CpcPlaygroundExportResult } from '../exports/exporters/export-cpc-playground'
import { rgbToFirmwareIndex } from '../exports/raster-format'
import {
  type OpenImageInPlaygroundInput,
  openImageInPlayground
} from './open-image-in-playground'
import type { PlaygroundExporter } from './ports'

function fakeExporter(result: CpcPlaygroundExportResult = { success: true }) {
  const exportStandard = vi.fn<PlaygroundExporter['exportStandard']>(
    async () => result
  )
  const exportModeR = vi.fn<PlaygroundExporter['exportModeR']>(
    async () => result
  )
  const exportEgx = vi.fn<PlaygroundExporter['exportEgx']>(async () => result)
  const exporter: PlaygroundExporter = {
    exportStandard,
    exportModeR,
    exportEgx
  }
  return { exporter, exportStandard, exportModeR, exportEgx }
}

const modeConfig = { width: 160, height: 200, mode: 0 } as CpcModeConfig

function baseInput(
  over: Partial<OpenImageInPlaygroundInput> = {}
): OpenImageInPlaygroundInput {
  return {
    modeConfig,
    cpcHardware: 'classic' as CPCHardware,
    modeR: null,
    egx: null,
    standard: null,
    ...over
  }
}

describe('openImageInPlayground', () => {
  it('returns no-export-data and calls nothing when no branch is set', async () => {
    const { exporter, exportStandard, exportModeR, exportEgx } = fakeExporter()

    const result = await openImageInPlayground(baseInput(), { exporter })

    expect(result).toEqual({ ok: false, mode: null, error: 'no-export-data' })
    expect(exportStandard).not.toHaveBeenCalled()
    expect(exportModeR).not.toHaveBeenCalled()
    expect(exportEgx).not.toHaveBeenCalled()
  })

  it('exports the standard branch (Classic) with firmware palette and filename', async () => {
    const { exporter, exportStandard } = fakeExporter()

    const result = await openImageInPlayground(
      baseInput({
        standard: {
          indexBuf: new Uint8Array([0, 1]),
          paletteFirmware: [1, 2],
          palettePlus: [10, 20]
        }
      }),
      { exporter }
    )

    expect(result).toEqual({ ok: true, mode: 'standard' })
    const opts = exportStandard.mock.calls[0]![0]
    expect(opts.paletteFirmware).toEqual([1, 2])
    expect(opts.palettePlus).toBeUndefined()
    expect(opts.hasRasters).toBe(false)
    expect(opts.rasterAsm).toBeUndefined()
    expect(opts.filename).toBe('pixsaur')
  })

  it('uses palettePlus on the standard branch for Plus hardware', async () => {
    const { exporter, exportStandard } = fakeExporter()

    await openImageInPlayground(
      baseInput({
        cpcHardware: 'plus',
        standard: {
          indexBuf: new Uint8Array([0]),
          paletteFirmware: [1],
          palettePlus: [42]
        }
      }),
      { exporter }
    )

    const opts = exportStandard.mock.calls[0]![0]
    expect(opts.palettePlus).toEqual([42])
    expect(opts.paletteFirmware).toBeUndefined()
  })

  it('generates classic raster ASM on the standard branch when rasters are present', async () => {
    const { exporter, exportStandard } = fakeExporter()
    const rasterChanges = [{ scanline: 0 }] as unknown as RasterChange[]

    await openImageInPlayground(
      baseInput({
        standard: {
          indexBuf: new Uint8Array([0]),
          paletteFirmware: [1, 2, 3],
          palettePlus: [],
          rasterChanges
        }
      }),
      { exporter }
    )

    const opts = exportStandard.mock.calls[0]![0]
    expect(opts.hasRasters).toBe(true)
    expect(typeof opts.rasterAsm).toBe('string')
  })

  it('exports the EGX branch, deriving firmware + RGB palettes', async () => {
    const { exporter, exportEgx } = fakeExporter()
    const palette = [
      [10, 20, 30],
      [40, 50, 60]
    ]

    const result = await openImageInPlayground(
      baseInput({
        egx: {
          indexBuffer: new Uint8Array([0, 1]),
          palette,
          width: 2,
          height: 1,
          config: DEFAULT_EGX_CONFIG
        }
      }),
      { exporter }
    )

    expect(result).toEqual({ ok: true, mode: 'egx' })
    const opts = exportEgx.mock.calls[0]![0]
    expect(opts.egxConfig).toBe(DEFAULT_EGX_CONFIG)
    expect(opts.paletteFirmware).toEqual([
      rgbToFirmwareIndex(10, 20, 30),
      rgbToFirmwareIndex(40, 50, 60)
    ])
    expect(opts.paletteRgb).toEqual(palette)
    expect(opts.filename).toBe('pixsaur_egx')
  })

  it('exports the Mode R branch (Plus) with CPC Plus palettes', async () => {
    const { exporter, exportModeR } = fakeExporter()
    const paletteA = [[1, 2, 3]]
    const paletteB = [[4, 5, 6]]

    const result = await openImageInPlayground(
      baseInput({
        cpcHardware: 'plus',
        modeR: {
          indexBufferA: new Uint8Array([0]),
          indexBufferB: new Uint8Array([1]),
          paletteA,
          paletteB
        }
      }),
      { exporter }
    )

    expect(result).toEqual({ ok: true, mode: 'modeR' })
    const opts = exportModeR.mock.calls[0]![0]
    expect(opts.paletteAPlus).toEqual(
      paletteToCPCPlusValues(paletteA as [number, number, number][])
    )
    expect(opts.paletteBPlus).toEqual(
      paletteToCPCPlusValues(paletteB as [number, number, number][])
    )
    expect(opts.paletteAFirmware).toBeUndefined()
    expect(opts.paletteBFirmware).toBeUndefined()
    expect(opts.filename).toBe('pixsaur_modeR')
  })

  it('prefers Mode R, then EGX, over the standard branch', async () => {
    const { exporter, exportModeR, exportEgx, exportStandard } = fakeExporter()

    await openImageInPlayground(
      baseInput({
        modeR: {
          indexBufferA: new Uint8Array([0]),
          indexBufferB: new Uint8Array([1]),
          paletteA: [[1, 2, 3]],
          paletteB: [[4, 5, 6]]
        },
        egx: {
          indexBuffer: new Uint8Array([0]),
          palette: [[1, 2, 3]],
          width: 1,
          height: 1,
          config: DEFAULT_EGX_CONFIG
        },
        standard: {
          indexBuf: new Uint8Array([0]),
          paletteFirmware: [1],
          palettePlus: []
        }
      }),
      { exporter }
    )

    expect(exportModeR).toHaveBeenCalledTimes(1)
    expect(exportEgx).not.toHaveBeenCalled()
    expect(exportStandard).not.toHaveBeenCalled()
  })

  it('maps an exporter failure to an error result with the branch mode', async () => {
    const { exporter } = fakeExporter({ success: false, error: 'boom' })

    const result = await openImageInPlayground(
      baseInput({
        standard: {
          indexBuf: new Uint8Array([0]),
          paletteFirmware: [1],
          palettePlus: []
        }
      }),
      { exporter }
    )

    expect(result).toEqual({ ok: false, mode: 'standard', error: 'boom' })
  })

  it('defaults the error message when the exporter reports failure without one', async () => {
    const { exporter } = fakeExporter({ success: false })

    const result = await openImageInPlayground(
      baseInput({
        egx: {
          indexBuffer: new Uint8Array([0]),
          palette: [[1, 2, 3]],
          width: 1,
          height: 1,
          config: DEFAULT_EGX_CONFIG
        }
      }),
      { exporter }
    )

    expect(result).toEqual({ ok: false, mode: 'egx', error: 'Unknown error' })
  })
})
