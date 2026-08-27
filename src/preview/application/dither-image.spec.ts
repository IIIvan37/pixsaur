import type { Vector } from '@/libs/pixsaur-color/src/type'
import { type DitherImageInput, ditherImage } from './dither-image'
import type { ImageDitherer } from './ports'

function fakeDitherer(buffer: Uint8ClampedArray) {
  const ditherFn = vi.fn<ImageDitherer['dither']>(() => buffer)
  const ditherer: ImageDitherer = { dither: ditherFn }
  return { ditherer, ditherFn }
}

function baseInput(over: Partial<DitherImageInput> = {}): DitherImageInput {
  return {
    normalized: new ImageData(2, 2),
    exportPalette: [
      [0, 0, 0],
      [255, 255, 255]
    ],
    dithering: { mode: 'none', intensity: 0 },
    modeConfig: { width: 2, height: 2 },
    resizeMode: 'origin',
    centerImage: false,
    ...over
  }
}

describe('ditherImage', () => {
  it('replaces ignored slots with the darkest valid color before dithering', () => {
    const palette: Vector[] = [
      [100, 100, 100],
      [-1, -1, -1],
      [10, 10, 10]
    ]
    const { ditherer, ditherFn } = fakeDitherer(new Uint8ClampedArray(16))

    ditherImage(baseInput({ exportPalette: palette }), { ditherer })

    // darkest valid color is [10,10,10]; the ignored slot is swapped for it.
    expect(ditherFn.mock.calls[0][1]).toEqual([
      [100, 100, 100],
      [10, 10, 10],
      [10, 10, 10]
    ])
  })

  it('forwards the normalized image and dithering config to the ditherer', () => {
    const normalized = new ImageData(2, 2)
    const dithering = { mode: 'floydSteinberg' as const, intensity: 0.5 }
    const { ditherer, ditherFn } = fakeDitherer(new Uint8ClampedArray(16))

    ditherImage(baseInput({ normalized, dithering }), { ditherer })

    expect(ditherFn.mock.calls[0][0]).toBe(normalized)
    expect(ditherFn.mock.calls[0][2]).toEqual(dithering)
  })

  it('wraps the dithered buffer into ImageData at the normalized dimensions (origin)', () => {
    const buffer = new Uint8ClampedArray(16)
    buffer[0] = 42
    const { ditherer } = fakeDitherer(buffer)

    const result = ditherImage(baseInput({ resizeMode: 'origin' }), {
      ditherer
    })

    if (!result.ok) throw new Error('expected ok')
    expect(result.image.width).toBe(2)
    expect(result.image.height).toBe(2)
    expect(result.image.data[0]).toBe(42)
  })

  it('does not reposition in cover mode', () => {
    const { ditherer } = fakeDitherer(new Uint8ClampedArray(16))

    const result = ditherImage(
      baseInput({ resizeMode: 'cover', modeConfig: { width: 8, height: 8 } }),
      { ditherer }
    )

    if (!result.ok) throw new Error('expected ok')
    // cover keeps the normalized dimensions — modeConfig is ignored.
    expect(result.image.width).toBe(2)
    expect(result.image.height).toBe(2)
  })

  it('positions the dithered image into the target canvas in auto mode', () => {
    const { ditherer } = fakeDitherer(new Uint8ClampedArray(16))

    const result = ditherImage(
      baseInput({ resizeMode: 'auto', modeConfig: { width: 4, height: 4 } }),
      { ditherer }
    )

    if (!result.ok) throw new Error('expected ok')
    // auto mode places the 2x2 dithered image into the 4x4 target canvas.
    expect(result.image.width).toBe(4)
    expect(result.image.height).toBe(4)
  })
})

describe('ditherImage and the distinct-mapping channel', () => {
  it('forwards the source colour mapping to the ditherer', () => {
    const mapping = new Map([['255,0,0', 1]])
    const { ditherer, ditherFn } = fakeDitherer(new Uint8ClampedArray(16))

    ditherImage(baseInput({ sourceColorMapping: mapping }), { ditherer })

    expect(ditherFn.mock.calls[0][3]).toBe(mapping)
  })

  it('forwards null when there is no mapping', () => {
    const { ditherer, ditherFn } = fakeDitherer(new Uint8ClampedArray(16))

    ditherImage(baseInput(), { ditherer })

    expect(ditherFn.mock.calls[0][3]).toBe(null)
  })
})
