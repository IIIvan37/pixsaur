import { describe, expect, it } from 'vitest'
import type { ScrDskTemplateOptions } from './dsk-templates'
import { generateScrDskTemplate } from './dsk-templates'

describe('generateScrDskTemplate', () => {
  it('should generate a valid RASM template', () => {
    const options: ScrDskTemplateOptions = {
      scrBinFilename: 'screen.bin',
      scrLabel: 'screen_data',
      dskFilename: 'output.dsk',
      screenFilename: 'SCREEN.SCR'
    }

    const result = generateScrDskTemplate(options)

    expect(result).toContain('screen_data:')
    expect(result).toContain('incbin "screen.bin"')
    expect(result).toContain('screen_data_end:')
    expect(result).toContain("SAVE 'SCREEN.SCR'")
    expect(result).toContain("DSK, 'output.dsk'")
  })

  it('should include label in SAVE command', () => {
    const options: ScrDskTemplateOptions = {
      scrBinFilename: 'test.bin',
      scrLabel: 'my_label',
      dskFilename: 'test.dsk',
      screenFilename: 'TEST.SCR'
    }

    const result = generateScrDskTemplate(options)

    expect(result).toContain('my_label, my_label_end - my_label')
  })

  it('should handle special characters in filenames', () => {
    const options: ScrDskTemplateOptions = {
      scrBinFilename: 'my-screen_v2.bin',
      scrLabel: 'screen_v2',
      dskFilename: 'game_disk.dsk',
      screenFilename: 'GAME.SCR'
    }

    const result = generateScrDskTemplate(options)

    expect(result).toContain('incbin "my-screen_v2.bin"')
    expect(result).toContain("'game_disk.dsk'")
  })

  it('should generate correct structure order', () => {
    const options: ScrDskTemplateOptions = {
      scrBinFilename: 'data.bin',
      scrLabel: 'label',
      dskFilename: 'disk.dsk',
      screenFilename: 'FILE.SCR'
    }

    const result = generateScrDskTemplate(options)
    const lines = result.split('\n').filter((l) => l.trim())

    // Check order: label, incbin, label_end, SAVE
    expect(lines[0]).toContain('label:')
    expect(lines[1]).toContain('incbin')
    expect(lines[2]).toContain('label_end:')
    expect(lines[3]).toContain('SAVE')
  })
})
