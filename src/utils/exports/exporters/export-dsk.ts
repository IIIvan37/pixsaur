import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import { generateScrDskTemplate, generateScrLoaderClassic } from '../templates'
import type { ExportConfig } from '../types'
import { generateSCRAsmClassic } from './export-scr'

/**
 * Export DSK file with SCR data and loader
 * Generates a DSK disk image containing the screen file and an ASM loader
 */
export async function exportDsk(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  config: ExportConfig,
  asmLabel: string,
  isStandardMode: boolean,
  paletteFirmware: number[],
  additionalFiles?: Array<{
    name: string
    data: Uint8Array
    loadAddress?: number
    execAddress?: number
  }>
) {
  if (!config.content.includeDSK || !isStandardMode) {
    return
  }

  // 1. Generate SCR ASM file with palette injection for DSK
  const scrAsmContent = generateSCRAsmClassic(
    indexBuf,
    modeConfig,
    paletteFirmware,
    asmLabel
  )

  if (!scrAsmContent) {
    console.warn(
      'DSK export: SCR data is too large and was chunked. DSK export skipped.'
    )
    return
  }

  const scrAsmFilename = `${asmLabel}.asm`
  const dskFilename = `${config.filename || 'pixsaur'}.dsk`

  // 2. Generate loader ASM code
  const loaderAsmCode = generateScrLoaderClassic({
    dskFilename,
    screenFilename: 'IMAGE.SCR',
    mode: modeConfig.mode
  })

  // 3. Generate DSK template that includes the SCR ASM
  const dskTemplateCode = generateScrDskTemplate({
    scrAsmFilename,
    scrLabel: asmLabel,
    dskFilename,
    screenFilename: 'IMAGE.SCR'
  })

  // 4. Assemble with RASM to create the DSK using DSK Manager
  try {
    // Create RASM instance and get access to the module
    const { createRasmInstance, readDsk } = await import('@/libs/rasm-wasm')
    const rasmInstance = await createRasmInstance()
    const rasmModule = rasmInstance.getModule()

    // Note: DSK will be created automatically by the first SAVE directive
    console.log(`[DSK] Preparing to create DSK: ${dskFilename}`)

    // Write the SCR ASM file to RASM's virtual filesystem
    rasmModule.FS.writeFile(`/${scrAsmFilename}`, scrAsmContent)
    console.log(`[DSK] Wrote ${scrAsmFilename} to RASM virtual filesystem`)

    // Write the loader ASM file to RASM's virtual filesystem
    const loaderAsmFilename = 'loader.asm'
    rasmModule.FS.writeFile(`/${loaderAsmFilename}`, loaderAsmCode)
    console.log(`[DSK] Wrote ${loaderAsmFilename} to RASM virtual filesystem`)

    // Assemble the loader first
    const loaderResult = await rasmInstance.assemble(loaderAsmCode, {
      outputFile: 'loader.bin',
      exportType: 'dsk',
      dskFile: dskFilename
    })

    if (!loaderResult.success) {
      console.error('Loader assembly failed:', loaderResult.output)
      return
    }

    console.log('[DSK] Loader assembled successfully')

    // Now assemble the DSK template with SCR data
    const result = await rasmInstance.assemble(dskTemplateCode, {
      outputFile: 'output.bin',
      exportType: 'dsk',
      dskFile: dskFilename
    })

    if (result.success) {
      // Add any additional files to the DSK
      if (additionalFiles && additionalFiles.length > 0) {
        const { addFileToDsk } = await import('@/libs/rasm-wasm')

        for (const file of additionalFiles) {
          try {
            addFileToDsk(
              rasmModule,
              dskFilename,
              {
                name: file.name,
                data: file.data,
                loadAddress: file.loadAddress,
                execAddress: file.execAddress
              },
              {
                loadAddress: file.loadAddress,
                execAddress: file.execAddress
              }
            )
            console.log(`[DSK] Added additional file: ${file.name}`)
          } catch (error) {
            console.error(
              `[DSK] Failed to add file ${file.name}:`,
              error instanceof Error ? error.message : String(error)
            )
          }
        }
      }

      // Read the final DSK from virtual filesystem
      const dskData = readDsk(rasmModule, dskFilename)

      // Add the DSK file to the ZIP
      zip.file(dskFilename, dskData)
      console.log('DSK file generated successfully')
    } else {
      console.error('DSK generation failed:', result.output)
    }
  } catch (error) {
    console.error('Error during DSK assembly:', error)
  }
}
