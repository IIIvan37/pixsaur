import { describe, expect, it } from 'vitest'
import { CPCHardware } from '@/libs/types'
import {
  assembleModeRSnaSource,
  assembleSnaSource,
  generateClassicOverscanSnaTemplate,
  generateClassicScrSnaTemplate,
  generateModeRClassicSnaTemplate,
  generateModeRPlusSnaTemplate,
  generatePlusOverscanSnaTemplate,
  generatePlusScrSnaTemplate,
  generateSnaTemplate,
  type ModeRDataFiles,
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
        hardware: CPCHardware.CLASSIC
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
        hardware: CPCHardware.CLASSIC
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
        hardware: CPCHardware.CLASSIC
      })
      expect(mode0).toContain('#7c8C')

      // Mode 1
      const mode1 = generateClassicScrSnaTemplate({
        mode: 1,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: CPCHardware.CLASSIC
      })
      expect(mode1).toContain('#7c8D')

      // Mode 2
      const mode2 = generateClassicScrSnaTemplate({
        mode: 2,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: CPCHardware.CLASSIC
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
        hardware: CPCHardware.CLASSIC
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
        hardware: CPCHardware.CLASSIC
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
        hardware: CPCHardware.PLUS
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
        hardware: CPCHardware.PLUS
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
        hardware: CPCHardware.PLUS
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
        hardware: CPCHardware.CLASSIC
      })
      expect(classicScr).toContain('org #8000')
      expect(classicScr).not.toContain('SNASET CRTC_TYPE')

      // Classic Overscan
      const classicOverscan = generateSnaTemplate({
        mode: 0,
        height: 280,
        overscan: true,
        hasRasters: false,
        hardware: CPCHardware.CLASSIC
      })
      expect(classicOverscan).toContain('org #b000')
      expect(classicOverscan).toContain('tovercrt')

      // Plus SCR
      const plusScr = generateSnaTemplate({
        mode: 0,
        height: 200,
        overscan: false,
        hasRasters: false,
        hardware: CPCHardware.PLUS
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
        hardware: CPCHardware.PLUS
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
        hardware: CPCHardware.CLASSIC
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
        hardware: CPCHardware.PLUS
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
        hardware: CPCHardware.CLASSIC
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
        hardware: CPCHardware.CLASSIC
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

  describe('Mode R Templates', () => {
    describe('generateModeRClassicSnaTemplate', () => {
      it('should generate Mode R template for CPC Classic', () => {
        const template = generateModeRClassicSnaTemplate()

        expect(template).toContain('BUILDSNA')
        expect(template).toContain('BANKSET 0')
        expect(template).toContain('SNASET CRTC_TYPE, 0')
        expect(template).toContain('org #8000')
        expect(template).toContain('run #8000')
        // Mode R specific
        expect(template).toContain('ModeR_PaletteA_Hardware')
        expect(template).toContain('ModeR_PaletteB_Hardware')
        expect(template).toContain('topScanlines')
        expect(template).toContain('CRTCReg12')
        expect(template).toContain('WAIT_CYCLES')
        // Page switching
        expect(template).toContain('#bc0c')
        expect(template).toContain('xor #20')
        // Palette switching
        expect(template).toContain('ex hl, de')
        expect(template).toContain('setPalette')
      })

      it('should include VBlank wait routine', () => {
        const template = generateModeRClassicSnaTemplate()

        expect(template).toContain('wVb:')
        expect(template).toContain('#f5')
        expect(template).toContain('rra')
      })

      it('should include waitScanlines routine', () => {
        const template = generateModeRClassicSnaTemplate()

        expect(template).toContain('waitScanlines:')
        expect(template).toContain('WAIT_CYCLES 40')
        expect(template).toContain('WAIT_CYCLES 50')
      })

      it('should include raster loop for Mode R effect', () => {
        const template = generateModeRClassicSnaTemplate()

        expect(template).toContain('rasterLoop:')
        expect(template).toContain('#bd2d')
        expect(template).toContain('#bd2f')
        expect(template).toContain('222/2')
      })
    })

    describe('generateModeRPlusSnaTemplate', () => {
      it('should generate Mode R template for CPC Plus', () => {
        const template = generateModeRPlusSnaTemplate()

        expect(template).toContain('BUILDSNA')
        expect(template).toContain('BANKSET 0')
        expect(template).toContain('SNASET CRTC_TYPE, 3')
        expect(template).toContain('SNASET CPC_TYPE, 4')
        expect(template).toContain('org #8000')
        expect(template).toContain('run #8000')
        // Mode R specific
        expect(template).toContain('ModeR_PaletteA')
        expect(template).toContain('ModeR_PaletteB')
        // ASIC routines
        expect(template).toContain('Asic_unlock')
        expect(template).toContain('Asic_activate')
        expect(template).toContain('Asic_deactivate')
        expect(template).toContain('asic_unlock_seq')
        // ASIC palette address
        expect(template).toContain('#6400')
        expect(template).toContain('ldir')
      })

      it('should include ASIC unlock sequence', () => {
        const template = generateModeRPlusSnaTemplate()

        expect(template).toContain('defb 255, 0, 255, 119, 179')
        expect(template).toContain('defb 81, 168, 212, 98, 57, 156')
        expect(template).toContain('defb 70, 43, 21, 138, 205, 238')
      })

      it('should include WAIT_CYCLES macro', () => {
        const template = generateModeRPlusSnaTemplate()

        expect(template).toContain('MACRO WAIT_CYCLES _cycles')
        expect(template).toContain('@loops')
        expect(template).toContain('djnz')
        expect(template).toContain('MEND')
      })

      it('should include page switching for dual frame', () => {
        const template = generateModeRPlusSnaTemplate()

        expect(template).toContain('#bc0c')
        expect(template).toContain('CRTCReg12')
        expect(template).toContain('xor #20')
      })
    })

    describe('assembleModeRSnaSource', () => {
      it('should combine template with data files for Classic', () => {
        const template = generateModeRClassicSnaTemplate()

        const dataFiles: ModeRDataFiles = {
          paletteAAsm:
            'ModeR_PaletteA_Hardware:\n    DB #54,#54,#54,#54,#54,#54,#54,#54,#54,#54,#54,#54,#54,#54,#54,#54',
          paletteBAsm:
            'ModeR_PaletteB_Hardware:\n    DB #44,#44,#44,#44,#44,#44,#44,#44,#44,#44,#44,#44,#44,#44,#44,#44',
          frameAAsm: 'FrameA:\n    DB #00,#00,#00',
          frameBAsm: 'FrameB:\n    DB #FF,#FF,#FF'
        }

        const source = assembleModeRSnaSource(template, dataFiles)

        expect(source).toContain('=== PALETTE DATA ===')
        expect(source).toContain('ModeR_PaletteA_Hardware:')
        expect(source).toContain('ModeR_PaletteB_Hardware:')
        expect(source).toContain('=== FRAME A DATA ===')
        expect(source).toContain('org #4000')
        expect(source).toContain('FrameA:')
        expect(source).toContain('=== FRAME B DATA ===')
        expect(source).toContain('org #c000')
        expect(source).toContain('FrameB:')
      })

      it('should combine template with data files for Plus', () => {
        const template = generateModeRPlusSnaTemplate()

        const dataFiles: ModeRDataFiles = {
          paletteAAsm: 'ModeR_PaletteA:\n    DEFW #000, #111, #222, #333',
          paletteBAsm: 'ModeR_PaletteB:\n    DEFW #FFF, #EEE, #DDD, #CCC',
          frameAAsm: 'FrameA:\n    DB #00,#00,#00',
          frameBAsm: 'FrameB:\n    DB #FF,#FF,#FF'
        }

        const source = assembleModeRSnaSource(template, dataFiles)

        expect(source).toContain('=== PALETTE DATA ===')
        expect(source).toContain('ModeR_PaletteA:')
        expect(source).toContain('ModeR_PaletteB:')
        expect(source).toContain('org #4000')
        expect(source).toContain('org #c000')
        expect(source).toContain('Asic_unlock')
      })

      it('should place Frame A at #4000 and Frame B at #C000', () => {
        const template = generateModeRClassicSnaTemplate()

        const dataFiles: ModeRDataFiles = {
          paletteAAsm: 'ModeR_PaletteA_Hardware:\n    DB #54',
          paletteBAsm: 'ModeR_PaletteB_Hardware:\n    DB #44',
          frameAAsm: '; Frame A image data',
          frameBAsm: '; Frame B image data'
        }

        const source = assembleModeRSnaSource(template, dataFiles)

        // Check that org statements are in correct order
        const org4000Index = source.indexOf('org #4000')
        const orgC000Index = source.indexOf('org #c000')
        const frameAIndex = source.indexOf('; Frame A image data')
        const frameBIndex = source.indexOf('; Frame B image data')

        expect(org4000Index).toBeLessThan(orgC000Index)
        expect(org4000Index).toBeLessThan(frameAIndex)
        expect(frameAIndex).toBeLessThan(orgC000Index)
        expect(orgC000Index).toBeLessThan(frameBIndex)
      })
    })
  })
})
