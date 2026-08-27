import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig, EGXFirstLineMode, EGXType } from '@/libs/pixsaur-egx'
import { getMaxColorIndex, getModeForLine } from '@/libs/pixsaur-egx'
import { type QuantizeEgxInput, quantizeEgx } from './quantize-egx'

/** 16 evenly spread grey shades — enough to tell sub-palettes apart. */
const GREY_16: Vector<'RGB'>[] = Array.from(
  { length: 16 },
  (_, i) => [i * 17, i * 17, i * 17] as Vector<'RGB'>
)

/** RGBA ImageData filled with a horizontal grey ramp (varies along x). */
function rampImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const v = Math.round((x / Math.max(1, width - 1)) * 255)
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return new ImageData(data, width, height)
}

function config(type: EGXType, firstLineMode: EGXFirstLineMode): EGXConfig {
  return {
    type,
    firstLineMode,
    targetHardware: 'classic',
    ditheringMode: 'none',
    ditheringIntensity: 0
  }
}

function baseInput(over: Partial<QuantizeEgxInput> = {}): QuantizeEgxInput {
  return {
    normalized: rampImage(8, 4),
    palette: GREY_16,
    config: config('egx1', 'low'),
    dithering: { mode: 'none', intensity: 0 },
    ...over
  }
}

const TYPES: EGXType[] = ['egx1', 'egx2']
const FIRST_LINES: EGXFirstLineMode[] = ['low', 'high']
const DITHER_MODES = ['none', 'ostromoukhov', 'bayer4x4']

describe('quantizeEgx', () => {
  it('fails with an explicit error on an empty palette', () => {
    expect(quantizeEgx(baseInput({ palette: [] }))).toEqual({
      ok: false,
      error: 'empty EGX palette'
    })
  })

  it('returns a buffer at the normalized image dimensions and its palette', () => {
    const result = quantizeEgx(baseInput())

    if (!result.ok) throw new Error('expected ok')
    expect(result.indexBuffer.width).toBe(8)
    expect(result.indexBuffer.height).toBe(4)
    expect(result.indexBuffer.buffer.length).toBe(32)
    expect(result.indexBuffer.palette).toBe(GREY_16)
  })

  for (const type of TYPES) {
    for (const firstLineMode of FIRST_LINES) {
      for (const mode of DITHER_MODES) {
        const label = `${type} · first line ${firstLineMode} · dithering ${mode}`

        it(`keeps every index inside its line's sub-palette — ${label}`, () => {
          const cfg = config(type, firstLineMode)
          const result = quantizeEgx(
            baseInput({ config: cfg, dithering: { mode, intensity: 1 } })
          )

          if (!result.ok) throw new Error('expected ok')
          const { buffer, width, height } = result.indexBuffer

          for (let y = 0; y < height; y++) {
            const maxColorIndex = getMaxColorIndex(getModeForLine(y, cfg), type)
            for (let x = 0; x < width; x++) {
              expect(buffer[y * width + x]).toBeLessThanOrEqual(maxColorIndex)
            }
          }
        })

        it(`pairs the pixels of low-resolution lines — ${label}`, () => {
          const cfg = config(type, firstLineMode)
          const result = quantizeEgx(
            baseInput({ config: cfg, dithering: { mode, intensity: 1 } })
          )

          if (!result.ok) throw new Error('expected ok')
          const { buffer, width, height } = result.indexBuffer
          const highResMode = type === 'egx1' ? 1 : 2

          for (let y = 0; y < height; y++) {
            if (getModeForLine(y, cfg) === highResMode) continue
            for (let x = 0; x + 1 < width; x += 2) {
              expect(buffer[y * width + x]).toBe(buffer[y * width + x + 1])
            }
          }
        })
      }
    }
  }

  it('leaves high-resolution lines free to differ pixel by pixel', () => {
    const cfg = config('egx1', 'low')
    const result = quantizeEgx(baseInput({ config: cfg }))

    if (!result.ok) throw new Error('expected ok')
    const { buffer, width } = result.indexBuffer

    // Line 1 is the high-res (Mode 1) line: the ramp must not be paired there.
    const line = Array.from(buffer.slice(width, width * 2))
    const hasUnpairedNeighbours = line.some(
      (index, x) => x % 2 === 0 && index !== line[x + 1]
    )
    expect(hasUnpairedNeighbours).toBe(true)
  })

  it('assigns the trailing pixel of an odd-width low-resolution line on its own', () => {
    const cfg = config('egx1', 'low')
    const result = quantizeEgx(
      baseInput({ normalized: rampImage(5, 2), config: cfg })
    )

    if (!result.ok) throw new Error('expected ok')
    const { buffer, width } = result.indexBuffer
    // Line 0 is low-res: pairs (0,1) and (2,3) match, pixel 4 stands alone and
    // still maps to a real index rather than staying at the 0 default.
    expect(buffer[0]).toBe(buffer[1])
    expect(buffer[2]).toBe(buffer[3])
    expect(buffer[4]).toBeGreaterThan(buffer[0])
    expect(width).toBe(5)
  })
})
