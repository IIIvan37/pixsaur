import { describe, expect, it, vi } from 'vitest'
import {
  generateScrLoaderClassic,
  generateScrLoaderPlus,
  generateUniversalScrLoader
} from './scr-loader-template'

// Mock the logger to avoid console output during tests
vi.mock('@/core', () => ({
  dskLogger: {
    debug: vi.fn()
  }
}))

describe('scr-loader-template', () => {
  describe('generateScrLoaderClassic', () => {
    it('should generate valid Z80 assembly code', () => {
      const result = generateScrLoaderClassic({
        dskFilename: 'pixsaur.dsk',
        screenFilename: 'IMAGE.SCR',
        mode: 0
      })

      // Should contain org directive
      expect(result).toContain('org')

      // Should contain SAVE directive for RASM
      expect(result).toContain('SAVE')
      expect(result).toContain('LOADER.BIN')
      expect(result).toContain('pixsaur.dsk')
    })

    it('should include the screen filename in the code', () => {
      const result = generateScrLoaderClassic({
        dskFilename: 'test.dsk',
        screenFilename: 'MYIMAGE.SCR',
        mode: 1
      })

      expect(result).toContain('MYIMAGE.SCR')
    })

    it('should include the graphics mode', () => {
      const result = generateScrLoaderClassic({
        dskFilename: 'test.dsk',
        screenFilename: 'IMAGE.SCR',
        mode: 2
      })

      expect(result).toContain('ld  a, 2')
    })

    it('should include firmware function addresses', () => {
      const result = generateScrLoaderClassic({
        dskFilename: 'test.dsk',
        screenFilename: 'IMAGE.SCR',
        mode: 0
      })

      // CAS_IN_OPEN
      expect(result).toContain('#bc77')
      // CAS_IN_DIRECT
      expect(result).toContain('#bc83')
      // CAS_IN_CLOSE
      expect(result).toContain('#bc7a')
      // SCR_SET_MODE
      expect(result).toContain('#bc0e')
      // SCR_SET_BORDER
      expect(result).toContain('#bc38')
      // SCR_SET_INK
      expect(result).toContain('#bc32')
    })

    it('should include palette loading code', () => {
      const result = generateScrLoaderClassic({
        dskFilename: 'test.dsk',
        screenFilename: 'IMAGE.SCR',
        mode: 0
      })

      // Palette data offset
      expect(result).toContain('data+2000')
      // Loop for 16 colors
      expect(result).toContain('ld  b, #10')
    })
  })

  describe('generateUniversalScrLoader', () => {
    it('should generate valid Z80 assembly code', () => {
      const result = generateUniversalScrLoader('pixsaur-workspace.dsk')

      // Should contain org directive at #8000
      expect(result).toContain('org #8000')

      // Should contain SAVE directive for RASM
      expect(result).toContain('SAVE')
      expect(result).toContain('LOADER.BIN')
      expect(result).toContain('pixsaur-workspace.dsk')
    })

    it('should include BASIC parameter handling', () => {
      const result = generateUniversalScrLoader('test.dsk')

      // Should check parameter count
      expect(result).toContain('cp 1')

      // Should extract string descriptor
      expect(result).toContain('ex de, hl')
    })

    it('should include firmware function addresses', () => {
      const result = generateUniversalScrLoader('test.dsk')

      // CAS functions
      expect(result).toContain('cas_in_open equ #bc77')
      expect(result).toContain('cas_in_direct equ #bc83')
      expect(result).toContain('cas_in_close equ #bc7a')

      // SCR functions
      expect(result).toContain('scr_set_mode equ #bc0e')
      expect(result).toContain('scr_set_border equ #bc38')
      expect(result).toContain('scr_set_ink equ #bc32')
    })

    it('should include CPC Plus hardware detection', () => {
      const result = generateUniversalScrLoader('test.dsk')

      // Hardware type check at offset 2035
      expect(result).toContain('2035')

      // Jump to Plus format handler
      expect(result).toContain('plus_format')
    })

    it('should include CPC Plus ASIC unlock sequence', () => {
      const result = generateUniversalScrLoader('test.dsk')

      // ASIC unlock sequence label
      expect(result).toContain('asic_unlock_seq')

      // Part of the unlock sequence bytes
      expect(result).toContain('defb 255, 0, 255, 119, 179')
    })

    it('should include CPC Plus palette register addresses', () => {
      const result = generateUniversalScrLoader('test.dsk')

      // Pen 0 register
      expect(result).toContain('#6400')
      // Border register
      expect(result).toContain('#6420')
    })

    it('should include Classic palette loading code', () => {
      const result = generateUniversalScrLoader('test.dsk')

      // Classic format label
      expect(result).toContain('classic_format')

      // Palette loop
      expect(result).toContain('classic_palette_loop')

      // 16 colors loop counter
      expect(result).toContain('ld b, #10')
    })

    it('should load SCR data to temporary buffer then copy to screen', () => {
      const result = generateUniversalScrLoader('test.dsk')

      // Data buffer at #4000
      expect(result).toContain('data equ #4000')

      // Copy to screen memory #c000
      expect(result).toContain('ld de, #c000')

      // LDIR to copy
      expect(result).toContain('ldir')
    })

    it('should NOT return a placeholder string', () => {
      const result = generateUniversalScrLoader('test.dsk')

      // Should NOT be a simple placeholder
      expect(result).not.toBe('universal-loader')

      // Should be substantial code (at least 500 characters)
      expect(result.length).toBeGreaterThan(500)
    })
  })

  describe('generateScrLoaderPlus', () => {
    it('should generate assembly code with org directive', () => {
      const result = generateScrLoaderPlus({
        dskFilename: 'test.dsk',
        screenFilename: 'IMAGE.SCR',
        mode: 1
      })

      expect(result).toContain('org #8000')
    })

    it('should include the graphics mode', () => {
      const result = generateScrLoaderPlus({
        dskFilename: 'test.dsk',
        screenFilename: 'IMAGE.SCR',
        mode: 2
      })

      expect(result).toContain('ld a,2')
    })
  })
})

describe('DSK export regression tests', () => {
  describe('RASM assembly compatibility', () => {
    it('generateUniversalScrLoader should produce RASM-compatible code', () => {
      const result = generateUniversalScrLoader('pixsaur.dsk')

      // Must have org directive (RASM requirement)
      expect(result).toMatch(/org\s+#[0-9a-fA-F]+/i)

      // Must have SAVE directive (RASM DSK export)
      expect(result).toMatch(/SAVE\s+'/i)

      // Should have proper label definitions (no orphan labels)
      expect(result).toContain('start:')
      expect(result).toContain('load_file:')
      expect(result).toContain('display_screen:')
    })

    it('generateScrLoaderClassic should produce RASM-compatible code', () => {
      const result = generateScrLoaderClassic({
        dskFilename: 'test.dsk',
        screenFilename: 'IMAGE.SCR',
        mode: 0
      })

      // Must have org directive
      expect(result).toMatch(/org\s+#[0-9a-fA-F]+/i)

      // Must have SAVE directive
      expect(result).toMatch(/SAVE\s+'/i)

      // Should have start label
      expect(result).toContain('start:')
    })
  })

  describe('SCR format compliance', () => {
    it('should reference correct palette data offsets', () => {
      const universalLoader = generateUniversalScrLoader('test.dsk')
      const classicLoader = generateScrLoaderClassic({
        dskFilename: 'test.dsk',
        screenFilename: 'IMAGE.SCR',
        mode: 0
      })

      // Palette data at offset 2000 (both loaders)
      expect(universalLoader).toContain('2000')
      expect(classicLoader).toContain('2000')

      // Mode at offset 2034
      expect(universalLoader).toContain('2034')
    })

    it('should handle screen memory at #c000', () => {
      const universalLoader = generateUniversalScrLoader('test.dsk')
      const classicLoader = generateScrLoaderClassic({
        dskFilename: 'test.dsk',
        screenFilename: 'IMAGE.SCR',
        mode: 0
      })

      // Screen memory destination
      expect(universalLoader).toContain('#c000')
      expect(classicLoader).toContain('#c000')
    })
  })
})
