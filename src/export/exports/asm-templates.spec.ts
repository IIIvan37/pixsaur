import { describe, expect, it } from 'vitest'
import {
  generateASMComment,
  generateDataSection,
  generatePaletteSection
} from './asm-templates'

describe('generateASMComment', () => {
  it('should generate comment for SCR format', () => {
    const result = generateASMComment('test.scr', 'scr')

    expect(result).toContain('; Pixsaur Export - test.scr')
    expect(result).toContain('; Format: CPC Screen Format (16Ko, entrelaced)')
    expect(result).toContain('; Generated:')
  })

  it('should generate comment for linear format', () => {
    const result = generateASMComment('test.bin', 'linear')

    expect(result).toContain('; Pixsaur Export - test.bin')
    expect(result).toContain('; Format: Linear Format (sequential bytes)')
  })
})

describe('generateDataSection', () => {
  it('should generate data section with label', () => {
    const data = new Uint8Array([0x00, 0x0f, 0xff])
    const result = generateDataSection(data, 'TestData')

    expect(result).toContain('TestData:')
    expect(result).toContain('DB      #00,#0F,#FF')
  })

  it('should generate data without label when empty', () => {
    const data = new Uint8Array([0xab, 0xcd])
    const result = generateDataSection(data, '')

    expect(result).not.toContain(':')
    expect(result).toContain('DB      #AB,#CD')
  })

  it('should split data into lines of 16 bytes', () => {
    const data = new Uint8Array(32).fill(0x42)
    const result = generateDataSection(data, 'Data', 16)

    const lines = result.split('\n')
    // 1 label line + 2 data lines (32 / 16 = 2)
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('DB')
    expect(lines[2]).toContain('DB')
  })

  it('should respect custom bytesPerLine', () => {
    const data = new Uint8Array(12).fill(0x11)
    const result = generateDataSection(data, 'Data', 4)

    const lines = result.split('\n')
    // 1 label + 3 data lines (12 / 4 = 3)
    expect(lines).toHaveLength(4)
  })

  it('should handle empty data', () => {
    const data = new Uint8Array(0)
    const result = generateDataSection(data, 'Empty')

    expect(result).toBe('Empty:')
  })

  it('should format hex values with leading zeros', () => {
    const data = new Uint8Array([0x01, 0x0a])
    const result = generateDataSection(data, 'Test')

    expect(result).toContain('#01')
    expect(result).toContain('#0A')
  })
})

describe('generatePaletteSection', () => {
  it('should generate palette section with label', () => {
    const palette = [0, 1, 2, 3]
    const result = generatePaletteSection(palette, 'Colors')

    expect(result).toContain('Colors:')
    expect(result).toContain('DB      #00,#01,#02,#03')
  })

  it('should use default label when empty', () => {
    const palette = [10, 11, 12]
    const result = generatePaletteSection(palette, '')

    expect(result).toContain('Palette:')
    expect(result).toContain('DB      #0A,#0B,#0C')
  })

  it('should truncate palette to 16 colors', () => {
    const palette = Array.from({ length: 20 }, (_, i) => i)
    const result = generatePaletteSection(palette, 'Pal')

    // Should only have 16 values
    const dbLine = result.split('\n')[1]
    const values = dbLine.split(',')
    expect(values).toHaveLength(16)
  })

  it('should handle empty palette', () => {
    const result = generatePaletteSection([], 'Empty')

    expect(result).toContain('Empty:')
    expect(result).toContain('DB      ')
  })

  it('should format palette indices as hex', () => {
    const palette = [26] // CPC palette index 26
    const result = generatePaletteSection(palette, 'Test')

    expect(result).toContain('#1A')
  })
})
