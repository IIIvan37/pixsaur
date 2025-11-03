import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { generateScrDskTemplate } from '../dsk-templates'
import { exportSCR } from '../export-scr/export-scr'
import { toASMData } from '../to-asm-data'
import type { ExportConfig } from '../types'
import { getHeader } from './utils'

/**
 * Export DSK file with SCR data
 * Generates a DSK disk image containing the screen file
 */
export async function exportDsk(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  config: ExportConfig,
  asmLabel: string,
  isStandardMode: boolean
) {
  if (!config.content.includeDSK || !isStandardMode) {
    return
  }

  // 1. Generate SCR ASM file (without palette injection for DSK)
  const scr = exportSCR(indexBuf, modeConfig)
  const asmResult = toASMData(scr, asmLabel)

  if (typeof asmResult !== 'string') {
    console.warn(
      'DSK export: SCR data is too large and was chunked. DSK export skipped.'
    )
    return
  }

  const scrAsmFilename = `${asmLabel}.asm`
  const scrAsmContent = getHeader(modeConfig, 'SCR', false) + asmResult
  const dskFilename = `${config.filename || 'pixsaur'}.dsk`

  // 2. Generate DSK template that includes the SCR ASM
  const dskTemplateCode = generateScrDskTemplate({
    scrAsmFilename,
    scrLabel: asmLabel,
    dskFilename,
    screenFilename: 'IMAGE.SCR'
  })

  // 3. Assemble with RASM to create the DSK
  try {
    // Create RASM instance and get access to the module
    const { createRasmInstance } = await import('@/libs/rasm-wasm')
    const rasmInstance = await createRasmInstance()
    const rasmModule = rasmInstance.getModule()

    // Write the SCR ASM file to RASM's virtual filesystem
    rasmModule.FS.writeFile(`/${scrAsmFilename}`, scrAsmContent)
    console.log(`[DSK] Wrote ${scrAsmFilename} to RASM virtual filesystem`)

    // Now assemble the DSK template
    const result = await rasmInstance.assemble(dskTemplateCode, {
      outputFile: 'output.bin',
      exportType: 'dsk',
      dskFile: dskFilename
    })

    if (result.success && result.dsk) {
      // Add the DSK file to the ZIP
      zip.file(dskFilename, result.dsk)
      console.log('DSK file generated successfully')
    } else {
      console.error('DSK generation failed:', result.output)
    }
  } catch (error) {
    console.error('Error during DSK assembly:', error)
  }
}
