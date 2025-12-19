import { describe, expect, it } from 'vitest'
import {
  assembleSnaSource,
  generateClassicOverscanSnaTemplate,
  generateClassicScrSnaTemplate,
  generatePlusOverscanSnaTemplate,
  generatePlusScrSnaTemplate,
  generateSnaTemplate,
  type SnaDataFiles,
  type SnaTemplateOptions
} from './sna-templates'

describe('SNA Templates', () => {
  describe('generateClassicScrSnaTemplate', () => {
    it('should generate template without rasters', () => {
      const options: SnaTemplateOptions = {
        mode: 0,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: 'classic'
      }

      const template = generateClassicScrSnaTemplate(options)

      expect(template).toContain('BUILDSNA')
      expect(template).toContain('BANKSET 0')
      expect(template).toContain('org #8000')
      expect(template).toContain('run #8000')
      // Classic uses separate Palette_Hardware label
      expect(template).toContain('Palette_Hardware')
      expect(template).toContain('setPalette')
      expect(template).not.toContain('RasterData')
      expect(template).not.toContain('CLASSIC_RASTER')
    })

    it('should generate template with rasters', () => {
      const options: SnaTemplateOptions = {
        mode: 1,
        height: 200,
        overscan: false,
        hasRasters: true,
        hardware: 'classic'
      }

      const template = generateClassicScrSnaTemplate(options)

      expect(template).toContain('BUILDSNA')
      expect(template).toContain('RasterData')
      expect(template).toContain('jmp_table')
      expect(template).toContain('no_changes')
      expect(template).toContain('changes_1')
      expect(template).toContain('changes_2')
      // Mode 1 should use #8D
      expect(template).toContain('#7c8D')
    })

    it('should use correct Gate Array mode register for each mode', () => {
      // Mode 0
      const mode0 = generateClassicScrSnaTemplate({
        mode: 0,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: 'classic'
      })
      expect(mode0).toContain('#7c8C')

      // Mode 1
      const mode1 = generateClassicScrSnaTemplate({
        mode: 1,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: 'classic'
      })
      expect(mode1).toContain('#7c8D')

      // Mode 2
      const mode2 = generateClassicScrSnaTemplate({
        mode: 2,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: 'classic'
      })
      expect(mode2).toContain('#7c8E')
    })
  })

  describe('generateClassicOverscanSnaTemplate', () => {
    it('should generate overscan template without rasters', () => {
      const options: SnaTemplateOptions = {
        mode: 0,
        height: 280,
        overscan: true,
        hasRasters: false,
        hardware: 'classic'
      }

      const template = generateClassicOverscanSnaTemplate(options)

      expect(template).toContain('BUILDSNA')
      expect(template).toContain('org #b000')
      expect(template).toContain('tovercrt')
      expect(template).toContain('outcrtc')
      expect(template).toContain('affscr')
      expect(template).not.toContain('CLASSIC_RASTER')
    })

    it('should generate overscan template with rasters', () => {
      const options: SnaTemplateOptions = {
        mode: 0,
        height: 280,
        overscan: true,
        hasRasters: true,
        hardware: 'classic'
      }

      const template = generateClassicOverscanSnaTemplate(options)

      expect(template).toContain('BUILDSNA')
      expect(template).toContain('CLASSIC_RASTER 280')
      expect(template).toContain('sync_vbl')
      expect(template).toContain('wait_usec')
      expect(template).toContain('RasterData')
    })
  })

  describe('generatePlusScrSnaTemplate', () => {
    it('should generate Plus template without rasters', () => {
      const options: SnaTemplateOptions = {
        mode: 0,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: 'plus'
      }

      const template = generatePlusScrSnaTemplate(options)

      expect(template).toContain('BUILDSNA')
      expect(template).toContain('SNASET CPC_TYPE, 4')
      expect(template).toContain('SNASET CRTC_TYPE, 3')
      expect(template).toContain('Asic_unlock')
      expect(template).toContain('Asic_activate')
      expect(template).toContain('#6400') // Plus palette register
      expect(template).toContain('#6420') // Plus border register
      expect(template).not.toContain('PLUS_RASTER')
    })

    it('should generate Plus template with rasters', () => {
      const options: SnaTemplateOptions = {
        mode: 0,
        height: 200,
        overscan: false,
        hasRasters: true,
        hardware: 'plus'
      }

      const template = generatePlusScrSnaTemplate(options)

      expect(template).toContain('PLUS_RASTER 200')
      expect(template).toContain('RasterData')
      expect(template).toContain('asic_unlock_seq')
    })
  })

  describe('generatePlusOverscanSnaTemplate', () => {
    it('should generate Plus overscan template with rasters', () => {
      const options: SnaTemplateOptions = {
        mode: 0,
        height: 280,
        overscan: true,
        hasRasters: true,
        hardware: 'plus'
      }

      const template = generatePlusOverscanSnaTemplate(options)

      expect(template).toContain('BUILDSNA')
      expect(template).toContain('SNASET CPC_TYPE, 4')
      expect(template).toContain('SNASET CRTC_TYPE, 3')
      expect(template).toContain('org #b000')
      expect(template).toContain('PLUS_RASTER 280')
      expect(template).toContain('tovercrt')
      expect(template).toContain('sync_vbl')
    })
  })

  describe('generateSnaTemplate', () => {
    it('should dispatch to correct template based on options', () => {
      // Classic SCR
      const classicScr = generateSnaTemplate({
        mode: 0,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: 'classic'
      })
      expect(classicScr).toContain('org #8000')
      expect(classicScr).not.toContain('SNASET CRTC_TYPE')

      // Classic Overscan
      const classicOverscan = generateSnaTemplate({
        mode: 0,
        height: 280,
        overscan: true,
        hasRasters: false,
        hardware: 'classic'
      })
      expect(classicOverscan).toContain('org #b000')
      expect(classicOverscan).toContain('tovercrt')

      // Plus SCR
      const plusScr = generateSnaTemplate({
        mode: 0,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: 'plus'
      })
      expect(plusScr).toContain('SNASET CPC_TYPE, 4')
      expect(plusScr).toContain('SNASET CRTC_TYPE, 3')
      expect(plusScr).toContain('Asic_unlock')

      // Plus Overscan
      const plusOverscan = generateSnaTemplate({
        mode: 0,
        height: 280,
        overscan: true,
        hasRasters: false,
        hardware: 'plus'
      })
      expect(plusOverscan).toContain('SNASET CPC_TYPE, 4')
      expect(plusOverscan).toContain('SNASET CRTC_TYPE, 3')
      expect(plusOverscan).toContain('tovercrt')
    })
  })

  describe('assembleSnaSource', () => {
    it('should combine template with data files for standard SCR (Classic)', () => {
      const options: SnaTemplateOptions = {
        mode: 0,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: 'classic'
      }

      const template = generateSnaTemplate(options)

      const dataFiles: SnaDataFiles = {
        paletteAsm: 'Palette_Hardware:\n    DB #54,#4B',
        imageAsm: 'ImageData:\n    DB #00,#FF'
      }

      const source = assembleSnaSource(template, dataFiles, options)

      expect(source).toContain('BUILDSNA')
      // Classic uses separate Palette_Hardware label
      expect(source).toContain('=== PALETTE DATA ===')
      expect(source).toContain('Palette_Hardware:')
      expect(source).toContain('=== IMAGE DATA ===')
      expect(source).toContain('org #c000')
      expect(source).toContain('ImageData:')
    })

    it('should include palette data for Plus hardware', () => {
      const options: SnaTemplateOptions = {
        mode: 0,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: 'plus'
      }

      const template = generateSnaTemplate(options)

      const dataFiles: SnaDataFiles = {
        paletteAsm: 'Palette:\n    DEFW #000,#FFF',
        imageAsm: 'ImageData:\n    DB #00,#FF'
      }

      const source = assembleSnaSource(template, dataFiles, options)

      expect(source).toContain('=== PALETTE DATA ===')
      expect(source).toContain('Palette:')
    })

    it('should include raster data when provided', () => {
      const options: SnaTemplateOptions = {
        mode: 0,
        height: 200,
        overscan: false,
        hasRasters: true,
        hardware: 'classic'
      }

      const template = generateSnaTemplate(options)

      const dataFiles: SnaDataFiles = {
        paletteAsm: 'Palette_Hardware:\n    DB #54',
        rasterAsm: 'RasterData:\n    DB #00',
        imageAsm: 'ImageData:\n    DB #FF'
      }

      const source = assembleSnaSource(template, dataFiles, options)

      expect(source).toContain('=== RASTER DATA ===')
      expect(source).toContain('RasterData:')
    })

    it('should use #4268 address for overscan images', () => {
      const options: SnaTemplateOptions = {
        mode: 0,
        height: 280,
        overscan: true,
        hasRasters: false,
        hardware: 'classic'
      }

      const template = generateSnaTemplate(options)

      const dataFiles: SnaDataFiles = {
        paletteAsm: 'Palette_Hardware:\n    DB #54',
        imageAsm: 'ImageData_linear_chunk_0:\n    DB #00',
        imageAsm2: 'ImageData_linear_chunk_1:\n    DB #FF'
      }

      const source = assembleSnaSource(template, dataFiles, options)

      expect(source).toContain('org #4268')
      expect(source).toContain('ImageData_linear_chunk_0:')
      expect(source).toContain('ImageData_linear_chunk_1:')
    })
  })
})
