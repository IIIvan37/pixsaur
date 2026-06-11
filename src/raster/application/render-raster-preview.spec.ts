import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { IndexBuffer } from '@/preview/application/build-index-buffer'
import type { RasterRenderer } from './ports'
import {
  type RenderRasterPreviewDeps,
  renderRasterPreview
} from './render-raster-preview'

const PALETTE: Vector[] = [
  [0, 0, 0],
  [255, 0, 0],
  [0, 255, 0]
]

// 2x2 buffer: top row ink 1 (red), bottom row ink 2 (green).
const makeBuffer = (width = 2, height = 2): IndexBuffer => ({
  buffer: new Uint8Array([1, 1, 2, 2]),
  width,
  height,
  palette: PALETTE
})

const noRenderer: RenderRasterPreviewDeps = { renderer: null }

describe('renderRasterPreview', () => {
  it('renders on the CPU when no GPU renderer is injected', () => {
    const result = renderRasterPreview(
      {
        indexBuffer: makeBuffer(),
        changes: [],
        modeConfig: { width: 2, height: 2 }
      },
      noRenderer
    )

    expect(result).not.toBeNull()
    expect(result?.width).toBe(2)
    expect(result?.height).toBe(2)
    // Top-left pixel maps ink 1 -> red.
    expect(Array.from(result!.data.slice(0, 4))).toEqual([255, 0, 0, 255])
    // Bottom-left pixel maps ink 2 -> green.
    expect(Array.from(result!.data.slice(8, 12))).toEqual([0, 255, 0, 255])
  })

  it('applies per-line raster changes via the CPU renderer', () => {
    const changes: RasterChange[] = [
      { id: 'a', line: 1, inkIndex: 2, color: [0, 0, 255] }
    ]
    const result = renderRasterPreview(
      {
        indexBuffer: makeBuffer(),
        changes,
        modeConfig: { width: 2, height: 2 }
      },
      noRenderer
    )

    // Line 1 redefines ink 2 -> blue.
    expect(Array.from(result!.data.slice(8, 12))).toEqual([0, 0, 255, 255])
  })

  it('returns null when buffer dimensions no longer match the mode config', () => {
    const result = renderRasterPreview(
      {
        indexBuffer: makeBuffer(2, 2),
        changes: [],
        modeConfig: { width: 4, height: 2 }
      },
      noRenderer
    )

    expect(result).toBeNull()
  })

  it('uses the GPU renderer when present and copies its output', () => {
    const gpuOut = new ImageData(2, 2)
    gpuOut.data.set([9, 9, 9, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    let received: unknown[] | null = null
    const renderer: RasterRenderer = {
      renderRasterPreview: (...args) => {
        received = args
        return gpuOut
      }
    }

    const result = renderRasterPreview(
      {
        indexBuffer: makeBuffer(),
        changes: [],
        modeConfig: { width: 2, height: 2 }
      },
      { renderer }
    )

    expect(received).not.toBeNull()
    expect(result?.width).toBe(2)
    // Same pixels...
    expect(Array.from(result!.data.slice(0, 4))).toEqual([9, 9, 9, 9])
    // ...but a fresh buffer, not the GPU-owned one.
    expect(result!.data).not.toBe(gpuOut.data)
  })

  it('falls back to the CPU renderer when the GPU renderer throws', () => {
    const renderer: RasterRenderer = {
      renderRasterPreview: () => {
        throw new Error('GPU lost')
      }
    }

    const result = renderRasterPreview(
      {
        indexBuffer: makeBuffer(),
        changes: [],
        modeConfig: { width: 2, height: 2 }
      },
      { renderer }
    )

    // CPU path still produces the red/green preview.
    expect(result).not.toBeNull()
    expect(Array.from(result!.data.slice(0, 4))).toEqual([255, 0, 0, 255])
  })
})
