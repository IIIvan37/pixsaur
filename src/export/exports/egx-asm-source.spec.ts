import type { EGXConfig } from '@/libs/pixsaur-egx'
import { egxAsmSource } from './egx-asm-source'

const egx1: EGXConfig = {
  type: 'egx1',
  firstLineMode: 'low',
  targetHardware: 'classic',
  ditheringMode: 'none',
  ditheringIntensity: 0
}

const egx2: EGXConfig = { ...egx1, type: 'egx2' }

function indexBuf(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(width * height)
  for (let i = 0; i < buf.length; i++) buf[i] = i % 4
  return buf
}

describe('egxAsmSource', () => {
  describe('missing palette', () => {
    it('returns null when Classic has no firmware palette', () => {
      const source = egxAsmSource({
        indexBuf: indexBuf(320, 200),
        width: 320,
        height: 200,
        egxConfig: egx1,
        hardware: 'classic'
      })

      expect(source).toBeNull()
    })

    it('returns null when Plus has no RGB palette', () => {
      const source = egxAsmSource({
        indexBuf: indexBuf(320, 200),
        width: 320,
        height: 200,
        egxConfig: egx1,
        paletteFirmware: [0, 1, 26],
        hardware: 'plus'
      })

      expect(source).toBeNull()
    })
  })

  describe('CPC Classic', () => {
    it('emits the hardware palette and SCR image data at #c000', () => {
      const source = egxAsmSource({
        indexBuf: indexBuf(320, 200),
        width: 320,
        height: 200,
        egxConfig: egx1,
        paletteFirmware: [0, 1, 26]
      })

      expect(source).toContain('Palette_Hardware:')
      expect(source).toContain('DB      #54,#44,#4B')
      expect(source).toContain('org #c000')
      expect(source).toContain('ImageData:')
      expect(source).not.toContain('ImageData_chunk_1:')
    })

    it('defaults to Classic when no hardware is given', () => {
      const options = {
        indexBuf: indexBuf(320, 200),
        width: 320,
        height: 200,
        egxConfig: egx1,
        paletteFirmware: [0, 1, 26]
      }

      expect(egxAsmSource(options)).toBe(
        egxAsmSource({ ...options, hardware: 'classic' })
      )
    })

    it('splits overscan image data into two linear chunks at #4268', () => {
      const source = egxAsmSource({
        indexBuf: indexBuf(320, 208),
        width: 320,
        height: 208,
        egxConfig: egx1,
        paletteFirmware: [0, 1, 26]
      })

      expect(source).toContain('ImageData_chunk_0:')
      expect(source).toContain('ImageData_chunk_1:')
      expect(source).toContain('org     #4268')
    })
  })

  describe('CPC Plus', () => {
    it('emits the 12-bit palette as DEFW', () => {
      const source = egxAsmSource({
        indexBuf: indexBuf(320, 200),
        width: 320,
        height: 200,
        egxConfig: egx1,
        paletteRgb: [
          [0, 0, 0],
          [255, 255, 255]
        ],
        hardware: 'plus'
      })

      expect(source).toContain('Palette_Plus:')
      expect(source).toContain('DEFW #0000, #0FFF')
      expect(source).not.toContain('Palette_Hardware:')
    })
  })

  describe('colour count', () => {
    it('emits 16 slots for EGX1 and 4 for EGX2', () => {
      const paletteFirmware = new Array(20).fill(0).map((_, i) => i)

      const first = egxAsmSource({
        indexBuf: indexBuf(320, 200),
        width: 320,
        height: 200,
        egxConfig: egx1,
        paletteFirmware
      })
      const second = egxAsmSource({
        indexBuf: indexBuf(640, 200),
        width: 640,
        height: 200,
        egxConfig: egx2,
        paletteFirmware
      })

      const slots = (source: string | null) =>
        source?.split('DB      ')[1]?.split('\n')[0]?.split(',').length

      expect(slots(first)).toBe(16)
      expect(slots(second)).toBe(4)
    })
  })
})
