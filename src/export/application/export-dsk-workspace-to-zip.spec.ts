import type { DskImage } from '../exports/types'
import {
  DSK_WORKSPACE_ZIP_FILENAME,
  exportDskWorkspaceToZip
} from './export-dsk-workspace-to-zip'
import type { DskWorkspaceBuilder, FileSink } from './ports'

function makeImage(id: string): DskImage {
  return {
    id,
    name: id.toUpperCase(),
    scrData: [0, 1, 2, 3],
    mode: 0,
    width: 160,
    height: 200,
    overscan: false,
    nColors: 16,
    scaleX: 4,
    scaleY: 2,
    cpcHardware: 'classic',
    paletteFirmware: [1, 2, 3]
  }
}

function fakeBuilder(blob: Blob | null) {
  const buildZip = vi.fn(async () => blob)
  return { builder: { buildZip } as DskWorkspaceBuilder, buildZip }
}

function fakeFileSink(saved = true) {
  const save = vi.fn(async () => saved)
  return { sink: { save } as FileSink, save }
}

const zipBlob = new Blob(['dsk'], { type: 'application/zip' })

describe('exportDskWorkspaceToZip', () => {
  it('builds the workspace ZIP and hands it to the file sink', async () => {
    const images = [makeImage('a'), makeImage('b')]
    const { builder, buildZip } = fakeBuilder(zipBlob)
    const { sink, save } = fakeFileSink()

    const result = await exportDskWorkspaceToZip(
      { images },
      { dskWorkspaceBuilder: builder, fileSink: sink }
    )

    expect(result).toEqual({ ok: true })
    expect(buildZip).toHaveBeenCalledWith(images)
    expect(save).toHaveBeenCalledWith(zipBlob, DSK_WORKSPACE_ZIP_FILENAME)
  })

  it('rejects an empty workspace without touching the ports', async () => {
    const { builder, buildZip } = fakeBuilder(zipBlob)
    const { sink, save } = fakeFileSink()

    const result = await exportDskWorkspaceToZip(
      { images: [] },
      { dskWorkspaceBuilder: builder, fileSink: sink }
    )

    expect(result).toEqual({ ok: false, error: 'no-images' })
    expect(buildZip).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('reports a failed assembly and never saves', async () => {
    const { builder } = fakeBuilder(null)
    const { sink, save } = fakeFileSink()

    const result = await exportDskWorkspaceToZip(
      { images: [makeImage('a')] },
      { dskWorkspaceBuilder: builder, fileSink: sink }
    )

    expect(result).toEqual({ ok: false, error: 'zip-generation-failed' })
    expect(save).not.toHaveBeenCalled()
  })

  it('reports a dismissed save dialog as cancelled', async () => {
    const { builder } = fakeBuilder(zipBlob)
    const { sink } = fakeFileSink(false)

    const result = await exportDskWorkspaceToZip(
      { images: [makeImage('a')] },
      { dskWorkspaceBuilder: builder, fileSink: sink }
    )

    expect(result).toEqual({ ok: false, error: 'save-cancelled' })
  })

  it('propagates a builder failure to the caller', async () => {
    const buildZip = vi.fn(async () => {
      throw new Error('rasm exploded')
    })
    const { sink, save } = fakeFileSink()

    await expect(
      exportDskWorkspaceToZip(
        { images: [makeImage('a')] },
        {
          dskWorkspaceBuilder: { buildZip } as unknown as DskWorkspaceBuilder,
          fileSink: sink
        }
      )
    ).rejects.toThrow('rasm exploded')
    expect(save).not.toHaveBeenCalled()
  })
})
