import type { CanvasFactory, FileSink } from '@/export/application/ports'
import type { TilesetSheet } from './convert-tileset'
import { saveTilesetSheet } from './save-tileset-sheet'

const sheet: TilesetSheet = {
  width: 2,
  height: 1,
  data: new Uint8ClampedArray(2 * 1 * 4)
}

function fakeCanvasFactory(blob: Blob | null = new Blob(['png'])) {
  const putImageData = vi.fn()
  const toBlob = vi.fn((done: (blob: Blob | null) => void) => done(blob))
  const canvas = {
    getContext: () => ({ putImageData }),
    toBlob
  } as unknown as HTMLCanvasElement
  const factory: CanvasFactory = { createCanvas: vi.fn(() => canvas) }
  return { factory, putImageData, toBlob }
}

/** A canvas the browser refuses a 2d context for — the one failure worth naming. */
function contextlessCanvasFactory(): CanvasFactory {
  const canvas = { getContext: () => null } as unknown as HTMLCanvasElement
  return { createCanvas: () => canvas }
}

function fakeFileSink(ok = true) {
  const save = vi.fn(async () => ok)
  return { sink: { save } as FileSink, save }
}

describe('saveTilesetSheet', () => {
  it('sizes the canvas to the sheet', async () => {
    const { factory } = fakeCanvasFactory()

    await saveTilesetSheet(
      { sheet, filename: 'tileset.png' },
      { canvasFactory: factory, fileSink: fakeFileSink().sink }
    )

    expect(factory.createCanvas).toHaveBeenCalledWith(2, 1)
  })

  it('hands the file to the sink under the name asked for', async () => {
    const { save, sink } = fakeFileSink()

    await saveTilesetSheet(
      { sheet, filename: 'planche.png' },
      { canvasFactory: fakeCanvasFactory().factory, fileSink: sink }
    )

    expect(save).toHaveBeenCalledWith(expect.any(Blob), 'planche.png')
  })

  it('reports the success back', async () => {
    const result = await saveTilesetSheet(
      { sheet, filename: 'tileset.png' },
      {
        canvasFactory: fakeCanvasFactory().factory,
        fileSink: fakeFileSink().sink
      }
    )

    expect(result).toEqual({ ok: true })
  })

  it('names the failure when the browser gives no 2d context', async () => {
    const result = await saveTilesetSheet(
      { sheet, filename: 'tileset.png' },
      {
        canvasFactory: contextlessCanvasFactory(),
        fileSink: fakeFileSink().sink
      }
    )

    expect(result).toEqual({ ok: false, error: 'no-canvas-context' })
  })

  it('names the failure when the canvas encodes nothing', async () => {
    const result = await saveTilesetSheet(
      { sheet, filename: 'tileset.png' },
      {
        canvasFactory: fakeCanvasFactory(null).factory,
        fileSink: fakeFileSink().sink
      }
    )

    expect(result).toEqual({ ok: false, error: 'encode-failed' })
  })

  it('saves nothing when the canvas encodes nothing', async () => {
    const { save, sink } = fakeFileSink()

    await saveTilesetSheet(
      { sheet, filename: 'tileset.png' },
      { canvasFactory: fakeCanvasFactory(null).factory, fileSink: sink }
    )

    expect(save).not.toHaveBeenCalled()
  })
})
