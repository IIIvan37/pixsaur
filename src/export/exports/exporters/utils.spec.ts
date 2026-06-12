import { describe, expect, it } from 'vitest'
import type { CpcModeConfig } from '@/domain/cpc'
import { getHeader } from './utils'

describe('getHeader', () => {
  describe('Mode 0', () => {
    it('should generate header for CPC Classic Mode 0', () => {
      const modeConfig = {
        mode: 0,
        width: 160,
        height: 200
      } as Partial<CpcModeConfig> as CpcModeConfig

      const result = getHeader(modeConfig, 'LINEAR', false)

      expect(result).toContain('LINEAR Data created with Pixsaur - CPC Classic')
      expect(result).toContain('Mode 0')
      expect(result).toContain('160x200 pixels')
      expect(result).toContain('80x200 bytes') // 2 pixels per byte in mode 0
    })

    it('should generate header for CPC+ Mode 0', () => {
      const modeConfig = {
        mode: 0,
        width: 160,
        height: 200
      } as Partial<CpcModeConfig> as CpcModeConfig

      const result = getHeader(modeConfig, 'LINEAR', true)

      expect(result).toContain('CPC+')
      expect(result).not.toContain('CPC Classic')
    })
  })

  describe('Mode 1', () => {
    it('should generate header for Mode 1', () => {
      const modeConfig = {
        mode: 1,
        width: 320,
        height: 200
      } as Partial<CpcModeConfig> as CpcModeConfig

      const result = getHeader(modeConfig, 'SCR', false)

      expect(result).toContain('Mode 1')
      expect(result).toContain('320x200 pixels')
      expect(result).toContain('80x200 bytes') // 4 pixels per byte in mode 1
    })
  })

  describe('Mode 2', () => {
    it('should generate header for Mode 2', () => {
      const modeConfig = {
        mode: 2,
        width: 640,
        height: 200
      } as Partial<CpcModeConfig> as CpcModeConfig

      const result = getHeader(modeConfig, 'LINEAR', false)

      expect(result).toContain('Mode 2')
      expect(result).toContain('640x200 pixels')
      expect(result).toContain('80x200 bytes') // 8 pixels per byte in mode 2
    })
  })

  describe('Overscan', () => {
    it('should indicate overscan when enabled', () => {
      const modeConfig = {
        mode: 0,
        width: 192,
        height: 272,
        overscan: true
      } as Partial<CpcModeConfig> as CpcModeConfig

      const result = getHeader(modeConfig, 'LINEAR', false)

      expect(result).toContain('Overscan')
      expect(result).toContain('192x272 pixels')
    })

    it('should not indicate overscan when disabled', () => {
      const modeConfig = {
        mode: 0,
        width: 160,
        height: 200,
        overscan: false
      } as Partial<CpcModeConfig> as CpcModeConfig

      const result = getHeader(modeConfig, 'LINEAR', false)

      expect(result).not.toMatch(/Overscan\s+/)
    })
  })

  describe('SCR type', () => {
    it('should include palette info for SCR type', () => {
      const modeConfig = {
        mode: 1,
        width: 320,
        height: 200
      } as Partial<CpcModeConfig> as CpcModeConfig

      const result = getHeader(modeConfig, 'SCR', false)

      expect(result).toContain('Palette data injected at offset 2000')
      expect(result).toContain('border at 2000')
      expect(result).toContain('firmware colors at 2001-2016')
    })

    it('should not include palette info for non-SCR types', () => {
      const modeConfig = {
        mode: 1,
        width: 320,
        height: 200
      } as Partial<CpcModeConfig> as CpcModeConfig

      const result = getHeader(modeConfig, 'LINEAR', false)

      expect(result).not.toContain('Palette data injected')
    })
  })
})
