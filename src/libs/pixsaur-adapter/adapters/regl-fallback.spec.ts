import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { createRasterPreviewImageData } from '@/libs/pixsaur-raster/render-with-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { ReGLProcessor } from './regl-processor'

function makePalette(
  overrides: Partial<Record<number, Vector>> = {}
): Vector[] {
  const base: Vector[] = new Array(16).fill(0).map(() => [0, 0, 0]) as Vector[]
  for (const [k, v] of Object.entries(overrides)) {
    base[Number(k)] = v as Vector
  }
  return base
}

describe('ReGLProcessor CPU fallback (colocated)', () => {
  it('renderRasterPreview matches CPU implementation when ReGL is unavailable', () => {
    // Instantiate with undefined ReGL to force CPU path
    const processor = new ReGLProcessor(undefined)

    const width = 3
    const height = 2
    const indexBuffer = new Uint8Array([0, 1, 2, 2, 1, 0])

    const palette = makePalette({
      0: [10, 0, 0],
      1: [0, 20, 0],
      2: [0, 0, 30]
    })

    const changes: RasterChange[] = [
      { id: 'x', line: 1, inkIndex: 1, color: [255, 255, 0] as Vector }
    ]

    const gpuLike = processor.renderRasterPreview(
      indexBuffer,
      width,
      height,
      palette,
      changes
    )

    const cpu = createRasterPreviewImageData(
      indexBuffer,
      width,
      height,
      palette,
      changes
    )

    expect(Array.from(gpuLike.data)).toEqual(Array.from(cpu.data))
  })
})
