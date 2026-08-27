import type { DskImage } from '../types'
import {
  generateDskStandardScr,
  isStandardDskMode,
  toDskModeConfig
} from './dsk-image-format'

function makeImage(overrides: Partial<DskImage> = {}): DskImage {
  return {
    id: 'img-1',
    name: 'TEST',
    scrData: Array.from({ length: 160 * 200 }, () => 1),
    mode: 0,
    width: 160,
    height: 200,
    overscan: false,
    nColors: 16,
    scaleX: 4,
    scaleY: 2,
    cpcHardware: 'classic',
    paletteFirmware: Array.from({ length: 16 }, (_, i) => i),
    ...overrides
  }
}

describe('toDskModeConfig', () => {
  it('projects the mode fields of a workspace image', () => {
    const image = makeImage({
      mode: 1,
      width: 384,
      height: 272,
      overscan: true,
      nColors: 4,
      scaleX: 2,
      scaleY: 2
    })

    expect(toDskModeConfig(image)).toEqual({
      mode: 1,
      width: 384,
      height: 272,
      overscan: true,
      nColors: 4,
      scaleX: 2,
      scaleY: 2
    })
  })
})

describe('isStandardDskMode', () => {
  const cases: Array<[string, Partial<DskImage>, boolean]> = [
    ['mode 0 at 160×200', { mode: 0, width: 160, height: 200 }, true],
    ['mode 1 at 320×200', { mode: 1, width: 320, height: 200 }, true],
    ['mode 2 at 640×200', { mode: 2, width: 640, height: 200 }, true],
    ['mode 0 at 320×200', { mode: 0, width: 320, height: 200 }, false],
    ['a custom height', { mode: 1, width: 320, height: 272 }, false],
    [
      'overscan at standard dimensions',
      { mode: 0, width: 160, height: 200, overscan: true },
      false
    ]
  ]

  it.each(cases)('%s → %s', (_label, overrides, expected) => {
    expect(isStandardDskMode(toDskModeConfig(makeImage(overrides)))).toBe(
      expected
    )
  })
})

describe('generateDskStandardScr', () => {
  const indexBuf = new Uint8Array(160 * 200).fill(1)

  it('injects the firmware palette for classic hardware', () => {
    const image = makeImage()
    const scr = generateDskStandardScr(indexBuf, toDskModeConfig(image), image)

    expect(scr.length).toBe(16384)
    expect(scr[2000]).toBe(image.paletteFirmware[0])
    expect(Array.from(scr.slice(2001, 2017))).toEqual(image.paletteFirmware)
    expect(scr[2034]).toBe(0)
    // hardware type: 0 = classic
    expect(scr[2035]).toBe(0)
  })

  it('injects the Plus palette and stamps the mode byte itself', () => {
    const image = makeImage({
      mode: 1,
      width: 320,
      cpcHardware: 'plus',
      palettePlus: Array.from({ length: 16 }, () => 0x0f0)
    })
    const scr = generateDskStandardScr(
      new Uint8Array(320 * 200).fill(1),
      toDskModeConfig(image),
      image
    )

    // hardware type: 1 = Plus
    expect(scr[2035]).toBe(1)
    // injectCPCPlusPaletteIntoSCR leaves 2034 to the caller
    expect(scr[2034]).toBe(1)
    expect(scr[2002]).not.toBe(0)
  })

  it('falls back to the firmware palette when Plus hardware has no Plus palette', () => {
    const image = makeImage({ cpcHardware: 'plus', palettePlus: undefined })
    const scr = generateDskStandardScr(indexBuf, toDskModeConfig(image), image)

    expect(scr[2035]).toBe(0)
    expect(Array.from(scr.slice(2001, 2017))).toEqual(image.paletteFirmware)
  })
})
