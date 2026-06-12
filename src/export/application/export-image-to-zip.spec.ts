import type { CpcModeConfig } from '@/domain/cpc'
import { DEFAULT_EGX_CONFIG } from '@/libs/pixsaur-egx'
import type { CPCHardware } from '@/libs/types'
import { rgbToFirmwareIndex } from '../exports/raster-format'
import { DEFAULT_EXPORT_CONFIG } from '../exports/types'
import {
  type ExportImageToZipInput,
  exportImageToZip
} from './export-image-to-zip'
import type { CanvasFactory, FileSink } from './ports'

const buildExportZipBlob = vi.hoisted(() => vi.fn())
vi.mock('../exports/export-zip', () => ({ buildExportZipBlob }))

function fakeCanvasFactory() {
  const putImageData = vi.fn()
  const canvas = {
    getContext: () => ({ putImageData })
  } as unknown as HTMLCanvasElement
  const factory: CanvasFactory = { createCanvas: vi.fn(() => canvas) }
  return { factory, canvas, putImageData }
}

function fakeFileSink(ok = true) {
  const save = vi.fn(async () => ok)
  return { sink: { save } as FileSink, save }
}

const modeConfig = { width: 160, height: 200, mode: 0 } as CpcModeConfig
const cpcHardware: CPCHardware = 'classic'

function baseInput(
  over: Partial<ExportImageToZipInput> = {}
): ExportImageToZipInput {
  return {
    modeConfig,
    cpcHardware,
    config: DEFAULT_EXPORT_CONFIG,
    egx: null,
    standard: null,
    ...over
  }
}

beforeEach(() => {
  buildExportZipBlob.mockReset()
  buildExportZipBlob.mockResolvedValue(new Blob(['zip']))
})

describe('exportImageToZip', () => {
  it('returns no-export-data and skips the zip when neither branch is set', async () => {
    const { factory } = fakeCanvasFactory()
    const { sink, save } = fakeFileSink()

    const result = await exportImageToZip(baseInput(), {
      canvasFactory: factory,
      fileSink: sink
    })

    expect(result).toEqual({ ok: false, error: 'no-export-data' })
    expect(buildExportZipBlob).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('exports the standard branch through the file sink', async () => {
    const { factory, canvas, putImageData } = fakeCanvasFactory()
    const { sink, save } = fakeFileSink()
    const cleanImage = new ImageData(2, 2)

    const result = await exportImageToZip(
      baseInput({
        standard: {
          indexBuf: new Uint8Array([0, 1, 0, 1]),
          paletteFirmware: [1, 2],
          effectivePalette: [
            [10, 20, 30],
            [40, 50, 60]
          ],
          cleanImage
        }
      }),
      { canvasFactory: factory, fileSink: sink }
    )

    expect(result).toEqual({ ok: true })
    expect(factory.createCanvas).toHaveBeenCalledWith(2, 2)
    expect(putImageData).toHaveBeenCalledWith(cleanImage, 0, 0)

    const params = buildExportZipBlob.mock.calls[0][0]
    expect(params.canvas).toBe(canvas)
    expect(params.paletteFirmware).toEqual([1, 2])
    expect(params.reducedPalette).toEqual([
      [10, 20, 30],
      [40, 50, 60]
    ])
    expect(save).toHaveBeenCalledWith(
      expect.any(Blob),
      `${DEFAULT_EXPORT_CONFIG.filename}.zip`
    )
  })

  it('exports the EGX branch, deriving firmware indices from the palette', async () => {
    const { factory, putImageData } = fakeCanvasFactory()
    const { sink } = fakeFileSink()

    const result = await exportImageToZip(
      baseInput({
        egx: {
          indexBuffer: new Uint8Array([0, 1]),
          palette: [
            [10, 20, 30],
            [40, 50, 60]
          ],
          width: 2,
          height: 1,
          config: DEFAULT_EGX_CONFIG
        }
      }),
      { canvasFactory: factory, fileSink: sink }
    )

    expect(result).toEqual({ ok: true })
    expect(factory.createCanvas).toHaveBeenCalledWith(2, 1)
    expect(putImageData).toHaveBeenCalled()

    const params = buildExportZipBlob.mock.calls[0][0]
    expect(params.egxConfig).toBe(DEFAULT_EGX_CONFIG)
    expect(params.egxWidth).toBe(2)
    expect(params.egxHeight).toBe(1)
    expect(params.paletteFirmware).toEqual([
      rgbToFirmwareIndex(10, 20, 30),
      rgbToFirmwareIndex(40, 50, 60)
    ])
  })

  it('prefers the EGX branch when both branches are present', async () => {
    const { factory } = fakeCanvasFactory()
    const { sink } = fakeFileSink()

    await exportImageToZip(
      baseInput({
        egx: {
          indexBuffer: new Uint8Array([0]),
          palette: [[1, 2, 3]],
          width: 1,
          height: 1,
          config: DEFAULT_EGX_CONFIG
        },
        standard: {
          indexBuf: new Uint8Array([0]),
          paletteFirmware: [9],
          effectivePalette: [[9, 9, 9]],
          cleanImage: new ImageData(1, 1)
        }
      }),
      { canvasFactory: factory, fileSink: sink }
    )

    expect(buildExportZipBlob.mock.calls[0][0].egxConfig).toBe(
      DEFAULT_EGX_CONFIG
    )
  })

  it('uses the configured filename for the saved archive', async () => {
    const { factory } = fakeCanvasFactory()
    const { sink, save } = fakeFileSink()

    await exportImageToZip(
      baseInput({
        config: { ...DEFAULT_EXPORT_CONFIG, filename: 'my_image' },
        standard: {
          indexBuf: new Uint8Array([0]),
          paletteFirmware: [1],
          effectivePalette: [[0, 0, 0]],
          cleanImage: new ImageData(1, 1)
        }
      }),
      { canvasFactory: factory, fileSink: sink }
    )

    expect(save).toHaveBeenCalledWith(expect.any(Blob), 'my_image.zip')
  })

  it('reports zip-generation-failed when the blob cannot be built', async () => {
    buildExportZipBlob.mockResolvedValue(null)
    const { factory } = fakeCanvasFactory()
    const { sink, save } = fakeFileSink()

    const result = await exportImageToZip(
      baseInput({
        standard: {
          indexBuf: new Uint8Array([0]),
          paletteFirmware: [1],
          effectivePalette: [[0, 0, 0]],
          cleanImage: new ImageData(1, 1)
        }
      }),
      { canvasFactory: factory, fileSink: sink }
    )

    expect(result).toEqual({ ok: false, error: 'zip-generation-failed' })
    expect(save).not.toHaveBeenCalled()
  })

  it('reports save-cancelled when the file sink declines to write', async () => {
    const { factory } = fakeCanvasFactory()
    const { sink } = fakeFileSink(false)

    const result = await exportImageToZip(
      baseInput({
        standard: {
          indexBuf: new Uint8Array([0]),
          paletteFirmware: [1],
          effectivePalette: [[0, 0, 0]],
          cleanImage: new ImageData(1, 1)
        }
      }),
      { canvasFactory: factory, fileSink: sink }
    )

    expect(result).toEqual({ ok: false, error: 'save-cancelled' })
  })
})
