import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { PaletteQuantizer } from './ports'
import { type QuantizePaletteInput, quantizePalette } from './quantize-palette'

function fakeQuantizer(palette: Vector[]) {
  const quantizePaletteFn = vi.fn<PaletteQuantizer['quantizePalette']>(
    async () => palette
  )
  const quantizer: PaletteQuantizer = { quantizePalette: quantizePaletteFn }
  return { quantizer, quantizePaletteFn }
}

function baseInput(
  over: Partial<QuantizePaletteInput> = {}
): QuantizePaletteInput {
  return {
    buf: new Uint8ClampedArray([0, 0, 0, 255]),
    sourceImage: { width: 2, height: 2 },
    lockedVecs: [],
    cpcHardware: 'classic',
    modeConfig: { nColors: 16 },
    lockedEmptyCount: 0,
    paletteStrategy: 'adaptive',
    autoDistinctMapping: false,
    colorDiversity: 0,
    ...over
  }
}

describe('quantizePalette', () => {
  it('returns the quantizer palette verbatim as rawPalette', async () => {
    const raw: Vector[] = [
      [10, 20, 30],
      [200, 100, 50]
    ]
    const { quantizer } = fakeQuantizer(raw)

    const result = await quantizePalette(baseInput(), { quantizer })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.rawPalette).toEqual(raw)
  })

  it('hardware-quantizes a copy for rgbPalette without mutating raw (classic)', async () => {
    const raw: Vector[] = [[10, 20, 200]]
    const { quantizer } = fakeQuantizer(raw)

    const result = await quantizePalette(
      baseInput({ cpcHardware: 'classic' }),
      { quantizer }
    )

    if (!result.ok) throw new Error('expected ok')
    // Classic levels are 0/128/255 — nearest for [10,20,200] is [0,0,255].
    expect(result.rgbPalette).toEqual([[0, 0, 255]])
    // Raw must stay untouched (rgb operates on a copy).
    expect(result.rawPalette).toEqual([[10, 20, 200]])
  })

  it('quantifies locked vectors to hardware before passing them to the quantizer', async () => {
    const { quantizer, quantizePaletteFn } = fakeQuantizer([])

    await quantizePalette(
      baseInput({ cpcHardware: 'classic', lockedVecs: [[10, 20, 200]] }),
      { quantizer }
    )

    const preselected = quantizePaletteFn.mock.calls[0][4]
    expect(preselected).toEqual([[0, 0, 255]])
  })

  it('truncates rgbPalette to nColors minus locked-empty slots', async () => {
    const raw: Vector[] = [
      [0, 0, 0],
      [255, 255, 255],
      [128, 128, 128]
    ]
    const { quantizer } = fakeQuantizer(raw)

    const result = await quantizePalette(
      baseInput({ modeConfig: { nColors: 4 }, lockedEmptyCount: 2 }),
      { quantizer }
    )

    if (!result.ok) throw new Error('expected ok')
    // effectiveMaxColors = 4 - 2 = 2
    expect(result.rgbPalette).toHaveLength(2)
    expect(result.rawPalette).toHaveLength(3)
  })

  it('requests the mode nColors as targetColors regardless of locked-empty count', async () => {
    const { quantizer, quantizePaletteFn } = fakeQuantizer([])

    await quantizePalette(
      baseInput({ modeConfig: { nColors: 16 }, lockedEmptyCount: 4 }),
      { quantizer }
    )

    const targetColors = quantizePaletteFn.mock.calls[0][2]
    expect(targetColors).toBe(16)
  })
})
