import {
  dbPaletteSection,
  HARDWARE_BLACK,
  hardwarePaletteAsm,
  plusPaletteAsm
} from './palette-asm'

describe('dbPaletteSection', () => {
  it('emits the label and one uppercase hex byte per slot', () => {
    expect(dbPaletteSection([0x00, 0x0f, 0xab], 'Palette')).toBe(
      'Palette:\n    DB      #00,#0F,#AB'
    )
  })

  it('emits an empty DB row for an empty palette', () => {
    expect(dbPaletteSection([], 'Palette')).toBe('Palette:\n    DB      ')
  })
})

describe('hardwarePaletteAsm', () => {
  it('maps firmware indices through the hardware table', () => {
    // firmware 0 = black (#54), 1 = blue (#44), 26 = bright white (#4B)
    const asm = hardwarePaletteAsm([0, 1, 26], { label: 'Palette_Hardware' })

    expect(asm).toBe('Palette_Hardware:\n    DB      #54,#44,#4B')
  })

  it('falls back to black for an index outside the firmware table', () => {
    const asm = hardwarePaletteAsm([99], { label: 'P' })

    expect(HARDWARE_BLACK).toBe(0x54)
    expect(asm).toBe('P:\n    DB      #54')
  })

  it('emits at most the 16 CPC slots by default', () => {
    const asm = hardwarePaletteAsm(new Array(20).fill(0), { label: 'P' })

    expect(asm.split(',')).toHaveLength(16)
  })

  it('honours an explicit colour count', () => {
    const asm = hardwarePaletteAsm([0, 1, 26, 6], {
      label: 'P',
      colorCount: 2
    })

    expect(asm).toBe('P:\n    DB      #54,#44')
  })
})

describe('plusPaletteAsm', () => {
  it('emits a DEFW row of 4-digit hex values', () => {
    expect(
      plusPaletteAsm([0x000, 0xfff, 0x0f0], { label: 'Palette_Plus' })
    ).toBe('Palette_Plus:\n    DEFW #0000, #0FFF, #00F0')
  })

  it('emits at most the 16 CPC slots by default', () => {
    const asm = plusPaletteAsm(new Array(20).fill(0), { label: 'P' })

    expect(asm.split(',')).toHaveLength(16)
  })

  it('honours an explicit colour count', () => {
    const asm = plusPaletteAsm([1, 2, 3, 4], { label: 'P', colorCount: 4 })

    expect(asm).toBe('P:\n    DEFW #0001, #0002, #0003, #0004')
  })
})
