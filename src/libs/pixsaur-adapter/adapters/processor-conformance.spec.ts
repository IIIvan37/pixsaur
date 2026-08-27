/**
 * One conformance suite for the two {@link ImageProcessor} implementations.
 *
 * It replaces `regl-processor.spec.ts`, which mocked `pixsaur-color` wholesale
 * and therefore only ever asserted that the single class forwarded to itself.
 * Here the CPU processor runs for real, and the GPU processor runs against a
 * fake `regl` — so what is asserted is the contract both must honour.
 */

import type REGL from 'regl'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { createRasterPreviewImageData } from '@/libs/pixsaur-raster/render-with-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { AdjustmentConfig, ImageProcessor } from '../interfaces'
import { CpuProcessor } from './cpu-processor'
import { GpuProcessor } from './gpu-processor'

function neutralAdjustments(
  overrides: Partial<AdjustmentConfig> = {}
): AdjustmentConfig {
  return {
    rgb: { r: 1, g: 1, b: 1 },
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    vibrance: 0,
    temperature: 0,
    tint: 0,
    gamma: 1,
    exposure: 0,
    highlights: 0,
    shadows: 0,
    posterization: 256,
    median: 0,
    sharpen: 0,
    blur: 0,
    edges: 0,
    chromaKeyEnabled: 0,
    chromaKeyColor: null,
    chromaKeyTolerance: 30,
    ...overrides
  }
}

/**
 * A `regl` stand-in: callable (commands) and carrying the helpers the adapters
 * use. It draws nothing, so GPU pixel output is not asserted — only the
 * contract and the delegation to the CPU processor are.
 */
function createFakeRegl(maxTextureSize = 2048): REGL.Regl {
  return Object.assign(
    vi.fn(() => vi.fn()),
    {
      _gl: {
        MAX_TEXTURE_SIZE: 0x0d33,
        getExtension: vi.fn(() => null),
        getParameter: vi.fn(() => maxTextureSize)
      },
      texture: vi.fn(() => Object.assign(vi.fn(), { destroy: vi.fn() })),
      framebuffer: vi.fn(() => ({
        use: vi.fn((callback: () => void) => callback()),
        destroy: vi.fn()
      })),
      read: vi.fn(),
      destroy: vi.fn()
    }
  ) as unknown as REGL.Regl
}

function makeImage(width: number, height: number, fill = 128): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill
    data[i + 1] = fill
    data[i + 2] = fill
    data[i + 3] = 255
  }
  return new ImageData(data, width, height)
}

function makePalette(size: number): Vector[] {
  return Array.from({ length: size }, (_, i) => [i * 8, i * 4, i * 2] as Vector)
}

const IMPLEMENTATIONS: Array<{
  name: string
  type: 'cpu' | 'gpu'
  create: () => ImageProcessor
}> = [
  { name: 'CpuProcessor', type: 'cpu', create: () => new CpuProcessor() },
  {
    name: 'GpuProcessor',
    type: 'gpu',
    create: () => new GpuProcessor(createFakeRegl())
  }
]

describe.each(IMPLEMENTATIONS)(
  'ImageProcessor conformance — $name',
  ({ type, create }) => {
    it('reports its implementation type', () => {
      expect(create().type).toBe(type)
    })

    it('applyAdjustments returns an image of the same dimensions', () => {
      const result = create().applyAdjustments(
        makeImage(4, 3),
        neutralAdjustments()
      )

      expect([result.width, result.height]).toEqual([4, 3])
    })

    it('applyAdjustments is synchronous', () => {
      const result = create().applyAdjustments(
        makeImage(4, 3),
        neutralAdjustments()
      )

      expect(result).toBeInstanceOf(ImageData)
    })

    it('quantizePalette returns the requested number of colors', async () => {
      const image = makeImage(8, 8)

      const palette = await create().quantizePalette(
        image.data,
        image,
        4,
        makePalette(27),
        []
      )

      expect(palette).toHaveLength(4)
    })

    it('renderRasterPreview returns an image of the requested size', () => {
      const result = create().renderRasterPreview(
        new Uint8Array([0, 1, 2, 2, 1, 0]),
        3,
        2,
        makePalette(16),
        []
      )

      expect([result.width, result.height]).toEqual([3, 2])
    })

    it('dispose is idempotent', () => {
      const processor = create()
      processor.dispose()

      expect(() => processor.dispose()).not.toThrow()
    })
  }
)

describe('CPU-only filters run whichever implementation is in use', () => {
  const keyed = neutralAdjustments({
    chromaKeyEnabled: 1,
    chromaKeyColor: [128, 128, 128],
    chromaKeyTolerance: 10
  })

  it('the chroma key blacks out matching pixels on the CPU path', () => {
    const result = new CpuProcessor().applyAdjustments(makeImage(2, 2), keyed)

    expect(Array.from(result.data.slice(0, 4))).toEqual([0, 0, 0, 255])
  })

  it('the GPU path uploads already-keyed pixels to the shader', () => {
    const regl = createFakeRegl()

    new GpuProcessor(regl).applyAdjustments(makeImage(2, 2), keyed)

    const uploaded = vi
      .mocked(regl.texture)
      .mock.calls.map(([spec]) => spec)
      .find(
        (spec): spec is { data: Uint8ClampedArray } =>
          typeof spec === 'object' && spec !== null && 'data' in spec
      )
    expect(Array.from(uploaded!.data.slice(0, 4))).toEqual([0, 0, 0, 255])
  })

  it('the median filter reaches the GPU path too', () => {
    const regl = createFakeRegl()
    const spotted = makeImage(3, 3)
    spotted.data.set([255, 255, 255, 255], 4 * 4) // one white pixel in a grey field

    new GpuProcessor(regl).applyAdjustments(
      spotted,
      neutralAdjustments({ median: 1 })
    )

    const uploaded = vi
      .mocked(regl.texture)
      .mock.calls.map(([spec]) => spec)
      .find(
        (spec): spec is { data: Uint8ClampedArray } =>
          typeof spec === 'object' && spec !== null && 'data' in spec
      )
    expect(Array.from(uploaded!.data.slice(16, 20))).toEqual([
      128, 128, 128, 255
    ])
  })
})

describe('CpuProcessor raster preview', () => {
  it('matches the pure CPU renderer', () => {
    const indexBuffer = new Uint8Array([0, 1, 2, 2, 1, 0])
    const palette = makePalette(16)
    const changes: RasterChange[] = [
      { id: 'x', line: 1, inkIndex: 1, color: [255, 255, 0] as Vector }
    ]

    const rendered = new CpuProcessor().renderRasterPreview(
      indexBuffer,
      3,
      2,
      palette,
      changes
    )

    expect(Array.from(rendered.data)).toEqual(
      Array.from(
        createRasterPreviewImageData(indexBuffer, 3, 2, palette, changes).data
      )
    )
  })
})

describe('GpuProcessor CPU delegation', () => {
  const image = makeImage(4, 4)
  const rasterChanges: RasterChange[] = []

  it('falls back to the CPU processor when the GPU quantizer refuses the image', async () => {
    const cpu = new CpuProcessor()
    const spy = vi.spyOn(cpu, 'quantizePalette')
    const processor = new GpuProcessor(createFakeRegl(), cpu)

    await processor.quantizePalette(image.data, image, 4, makePalette(27), [])

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('forwards the quantization options to the CPU fallback', async () => {
    const cpu = new CpuProcessor()
    const spy = vi.spyOn(cpu, 'quantizePalette')
    const processor = new GpuProcessor(createFakeRegl(), cpu)

    await processor.quantizePalette(
      image.data,
      image,
      4,
      makePalette(27),
      [],
      'coverage-aware',
      { autoDistinctMapping: true, colorDiversity: 90 }
    )

    expect(spy.mock.calls[0][6]).toEqual({
      autoDistinctMapping: true,
      colorDiversity: 90
    })
  })

  it('forwards the palette strategy to the CPU fallback', async () => {
    const cpu = new CpuProcessor()
    const spy = vi.spyOn(cpu, 'quantizePalette')
    const processor = new GpuProcessor(createFakeRegl(), cpu)

    await processor.quantizePalette(
      image.data,
      image,
      4,
      makePalette(27),
      [],
      'coverage-aware'
    )

    expect(spy.mock.calls[0][5]).toBe('coverage-aware')
  })

  it('renders the raster preview on the GPU rather than delegating', () => {
    const cpu = new CpuProcessor()
    const spy = vi.spyOn(cpu, 'renderRasterPreview')
    const processor = new GpuProcessor(createFakeRegl(), cpu)

    processor.renderRasterPreview(
      new Uint8Array([0, 1]),
      2,
      1,
      makePalette(16),
      rasterChanges
    )

    expect(spy).not.toHaveBeenCalled()
  })

  it('releases the regl instance on dispose', () => {
    const regl = createFakeRegl()
    new GpuProcessor(regl).dispose()

    expect(regl.destroy).toHaveBeenCalledTimes(1)
  })

  it('throws when a GPU command cannot be built', () => {
    const regl = createFakeRegl()
    const failing = Object.defineProperties(
      vi.fn(() => {
        throw new Error('shader compilation failed')
      }),
      Object.getOwnPropertyDescriptors({
        _gl: (regl as any)._gl,
        texture: regl.texture,
        framebuffer: regl.framebuffer,
        read: regl.read,
        destroy: regl.destroy
      })
    ) as unknown as REGL.Regl

    expect(() => new GpuProcessor(failing)).toThrow('shader compilation failed')
  })
})
