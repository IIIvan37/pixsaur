import type { CpcModeConfig } from '@/domain/cpc'
import { snaAsmSource } from './sna-asm-source'

const standard: CpcModeConfig = {
  mode: 0,
  width: 160,
  height: 200,
  overscan: false,
  nColors: 16,
  scaleX: 2,
  scaleY: 1
}

const overscan: CpcModeConfig = {
  mode: 0,
  width: 192,
  height: 272,
  overscan: true,
  nColors: 16,
  scaleX: 2,
  scaleY: 1
}

const firmware = Array.from({ length: 16 }, (_, i) => i)
const plus = Array.from({ length: 16 }, (_, i) => i * 0x111)

function indexBuf(modeConfig: CpcModeConfig): Uint8Array {
  const buf = new Uint8Array(modeConfig.width * modeConfig.height)
  for (let i = 0; i < buf.length; i++) buf[i] = i % modeConfig.nColors
  return buf
}

/** No `vi.mock` anywhere: the producer is pure, so it runs on real encoders. */
describe('snaAsmSource', () => {
  describe('missing palette', () => {
    it('reports the missing Classic palette', () => {
      const result = snaAsmSource({
        indexBuf: indexBuf(standard),
        modeConfig: standard,
        hardware: 'classic',
        hasRasters: false
      })

      expect(result).toEqual({
        error: 'Firmware palette required for Classic hardware'
      })
    })

    it('reports the missing Plus palette', () => {
      const result = snaAsmSource({
        indexBuf: indexBuf(standard),
        modeConfig: standard,
        hardware: 'plus',
        paletteFirmware: firmware,
        hasRasters: false
      })

      expect(result).toEqual({
        error: 'CPC Plus palette required for Plus hardware'
      })
    })
  })

  describe('standard screen', () => {
    it('emits the hardware palette and one SCR image block', () => {
      const result = snaAsmSource({
        indexBuf: indexBuf(standard),
        modeConfig: standard,
        hardware: 'classic',
        paletteFirmware: firmware,
        hasRasters: false
      })

      if ('error' in result) throw new Error(result.error)

      expect(result.source).toContain('Palette_Hardware:')
      expect(result.source).toContain('ImageData:')
      expect(result.source).not.toContain('ImageData_linear_chunk_1:')
      expect(result.source).not.toContain('RasterData:')
    })

    it('emits the Plus palette as DEFW for Plus hardware', () => {
      const result = snaAsmSource({
        indexBuf: indexBuf(standard),
        modeConfig: standard,
        hardware: 'plus',
        palettePlus: plus,
        hasRasters: false
      })

      if ('error' in result) throw new Error(result.error)

      expect(result.source).toContain('Palette:\n    DEFW #0000, #0111')
      expect(result.source).not.toContain('Palette_Hardware:')
    })

    it('includes the raster ASM only when rasters are enabled', () => {
      const options = {
        indexBuf: indexBuf(standard),
        modeConfig: standard,
        hardware: 'classic' as const,
        paletteFirmware: firmware,
        rasterAsm: 'RasterData:\n    DB #00'
      }

      const withRasters = snaAsmSource({ ...options, hasRasters: true })
      const without = snaAsmSource({ ...options, hasRasters: false })

      if ('error' in withRasters || 'error' in without) {
        throw new Error('expected both sources')
      }
      expect(withRasters.source).toContain('RasterData:')
      expect(without.source).not.toContain('RasterData:')
    })
  })

  describe('overscan screen', () => {
    it('emits the linear image data in two chunks', () => {
      const result = snaAsmSource({
        indexBuf: indexBuf(overscan),
        modeConfig: overscan,
        hardware: 'classic',
        paletteFirmware: firmware,
        hasRasters: false
      })

      if ('error' in result) throw new Error(result.error)

      expect(result.source).toContain('ImageData_linear_chunk_0:')
      expect(result.source).toContain('ImageData_linear_chunk_1:')
    })
  })
})
