import { describe, expect, it } from 'vitest'
import {
  generateDskImageFilename,
  sanitizeAmsdosFilename,
  validateAmsdosFilename
} from './amsdos-filename'

describe('validateAmsdosFilename', () => {
  it('validates correct 8.3 filenames', () => {
    expect(validateAmsdosFilename('FILE.SCR')).toEqual({ valid: true })
    expect(validateAmsdosFilename('IMAGE.BIN')).toEqual({ valid: true })
    expect(validateAmsdosFilename('TEST_01.DAT')).toEqual({ valid: true })
    expect(validateAmsdosFilename('A.X')).toEqual({ valid: true })
    expect(validateAmsdosFilename('12345678.ABC')).toEqual({ valid: true })
  })

  it('rejects empty filenames', () => {
    expect(validateAmsdosFilename('')).toEqual({
      valid: false,
      error: 'Filename cannot be empty'
    })
    expect(validateAmsdosFilename('   ')).toEqual({
      valid: false,
      error: 'Filename cannot be empty'
    })
  })

  it('rejects filenames without extension', () => {
    expect(validateAmsdosFilename('NOEXTENSION')).toEqual({
      valid: false,
      error: 'Filename must have format NAME.EXT'
    })
  })

  it('rejects filenames with multiple dots', () => {
    expect(validateAmsdosFilename('FILE.NAME.SCR')).toEqual({
      valid: false,
      error: 'Filename must have format NAME.EXT'
    })
  })

  it('rejects names longer than 8 characters', () => {
    expect(validateAmsdosFilename('TOOLONGNAME.SCR')).toEqual({
      valid: false,
      error: 'Name "TOOLONGNAME" exceeds 8 characters (11 chars)'
    })
  })

  it('rejects extensions longer than 3 characters', () => {
    expect(validateAmsdosFilename('FILE.SCRN')).toEqual({
      valid: false,
      error: 'Extension "SCRN" exceeds 3 characters (4 chars)'
    })
  })

  it('rejects filenames with lowercase letters', () => {
    expect(validateAmsdosFilename('file.scr')).toEqual({
      valid: false,
      error: 'Name can only contain A-Z, 0-9, and underscore'
    })
  })

  it('rejects filenames with invalid characters', () => {
    expect(validateAmsdosFilename('FILE-01.SCR')).toEqual({
      valid: false,
      error: 'Name can only contain A-Z, 0-9, and underscore'
    })
    expect(validateAmsdosFilename('FILE.S R')).toEqual({
      valid: false,
      error: 'Extension can only contain A-Z, 0-9, and underscore'
    })
  })

  it('rejects empty name or extension', () => {
    expect(validateAmsdosFilename('.SCR')).toEqual({
      valid: false,
      error: 'Filename cannot be empty before extension'
    })
    expect(validateAmsdosFilename('FILE.')).toEqual({
      valid: false,
      error: 'Extension cannot be empty'
    })
  })
})

describe('sanitizeAmsdosFilename', () => {
  it('converts to uppercase', () => {
    expect(sanitizeAmsdosFilename('file.scr')).toBe('FILE.SCR')
    expect(sanitizeAmsdosFilename('MyImage.Bin')).toBe('MYIMAGE.BIN')
  })

  it('truncates long names and extensions', () => {
    expect(sanitizeAmsdosFilename('VERYLONGFILENAME.SCR')).toBe('VERYLONG.SCR')
    expect(sanitizeAmsdosFilename('FILE.SCREEN')).toBe('FILE.SCR')
    expect(sanitizeAmsdosFilename('TOOLONGNAME.TOOLONGEXT')).toBe(
      'TOOLONGN.TOO'
    )
  })

  it('replaces spaces with underscores', () => {
    expect(sanitizeAmsdosFilename('MY FILE.SCR')).toBe('MY_FILE.SCR')
    expect(sanitizeAmsdosFilename('IMAGE  01.SCR')).toBe('IMAGE__0.SCR')
  })

  it('removes invalid characters', () => {
    expect(sanitizeAmsdosFilename('FILE-01.SCR')).toBe('FILE01.SCR')
    expect(sanitizeAmsdosFilename('TEST@#$.BIN')).toBe('TEST.BIN')
    expect(sanitizeAmsdosFilename('IM@GE!.S$R')).toBe('IMGE.SR')
  })

  it('adds default extension if missing', () => {
    expect(sanitizeAmsdosFilename('NOEXT')).toBe('NOEXT.SCR')
    expect(sanitizeAmsdosFilename('FILE', 'BIN')).toBe('FILE.BIN')
  })

  it('handles empty input with defaults', () => {
    expect(sanitizeAmsdosFilename('')).toBe('FILE.SCR')
    expect(sanitizeAmsdosFilename('', 'DAT')).toBe('FILE.DAT')
  })

  it('handles edge cases', () => {
    expect(sanitizeAmsdosFilename('...')).toBe('FILE.SCR')
    expect(sanitizeAmsdosFilename('...ext')).toBe('FILE.EXT')
    expect(sanitizeAmsdosFilename('###.###')).toBe('FILE.SCR')
  })

  it('preserves valid filenames', () => {
    expect(sanitizeAmsdosFilename('IMAGE_01.SCR')).toBe('IMAGE_01.SCR')
    expect(sanitizeAmsdosFilename('TEST123.BIN')).toBe('TEST123.BIN')
  })
})

describe('generateDskImageFilename', () => {
  it('generates sequential filenames with padding', () => {
    expect(generateDskImageFilename(1)).toBe('IMG00001.SCR')
    expect(generateDskImageFilename(10)).toBe('IMG00010.SCR')
    expect(generateDskImageFilename(99)).toBe('IMG00099.SCR')
    expect(generateDskImageFilename(500)).toBe('IMG00500.SCR')
  })

  it('supports up to 5 digits', () => {
    expect(generateDskImageFilename(99999)).toBe('IMG99999.SCR')
    expect(generateDskImageFilename(12345)).toBe('IMG12345.SCR')
  })

  it('generates valid AMSDOS filenames', () => {
    for (let i = 1; i <= 100; i++) {
      const filename = generateDskImageFilename(i)
      const validation = validateAmsdosFilename(filename)
      expect(validation.valid).toBe(true)
    }
  })
})
