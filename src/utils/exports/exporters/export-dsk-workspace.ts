import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { generateScrDskTemplate, generateScrLoaderClassic } from '../templates'
import { generateSCRAsmClassic } from './export-scr'

/**
 * Export DSK file from workspace images
 * Creates a DSK with multiple screen files from the workspace
 */
export async function exportDskWorkspace(
  images: DskImage[]
): Promise<Uint8Array | null> {
  if (images.length === 0) {
    console.warn('No images in workspace to export')
    return null
  }

  const dskFilename = 'pixsaur-workspace.dsk'

  try {
    // Create RASM instance and get access to the module
    const { createRasmInstance, createDsk, readDsk } = await import(
      '@/libs/rasm-wasm'
    )
    const rasmInstance = await createRasmInstance()
    const rasmModule = rasmInstance.getModule()

    // Create empty DSK
    createDsk(rasmModule, {
      filename: dskFilename,
      format: 'data'
    })
    console.log(`[DSK Workspace] Created empty DSK: ${dskFilename}`)

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const imageIndex = i + 1
      const scrFilename = `IMG${imageIndex.toString().padStart(2, '0')}.SCR`
      const asmLabel = `image${imageIndex}`

      console.log(
        `[DSK Workspace] Processing image ${imageIndex}/${images.length}: ${image.name}`
      )

      // Convert scrData array back to Uint8Array
      const scrData = new Uint8Array(image.scrData)

      // Generate SCR ASM content with palette firmware
      const modeConfig = {
        mode: image.mode,
        width: image.width,
        height: image.height,
        overscan: image.overscan,
        nColors: image.nColors,
        scaleX: image.scaleX,
        scaleY: image.scaleY
      }

      const scrAsmContent = generateSCRAsmClassic(
        scrData,
        modeConfig,
        image.paletteFirmware,
        asmLabel
      )

      if (!scrAsmContent) {
        console.warn(
          `[DSK Workspace] Skipping image ${image.name} - SCR data too large`
        )
        continue
      }

      const scrAsmFilename = `${asmLabel}.asm`

      // Write SCR ASM file to virtual filesystem
      rasmModule.FS.writeFile(`/${scrAsmFilename}`, scrAsmContent)

      // Generate loader for this image
      const loaderAsmCode = generateScrLoaderClassic({
        dskFilename,
        screenFilename: scrFilename,
        mode: image.mode
      })

      const loaderAsmFilename = `loader${imageIndex}.asm`
      rasmModule.FS.writeFile(`/${loaderAsmFilename}`, loaderAsmCode)

      // Assemble loader
      const loaderResult = await rasmInstance.assemble(loaderAsmCode, {
        outputFile: `loader${imageIndex}.bin`,
        exportType: 'dsk',
        dskFile: dskFilename
      })

      if (!loaderResult.success) {
        console.error(
          `[DSK Workspace] Loader assembly failed for ${image.name}:`,
          loaderResult.output
        )
        continue
      }

      // Generate DSK template code to save SCR to DSK
      const dskTemplateCode = generateScrDskTemplate({
        scrAsmFilename,
        scrLabel: asmLabel,
        dskFilename,
        screenFilename: scrFilename
      })

      // Assemble and save SCR to DSK
      const result = await rasmInstance.assemble(dskTemplateCode, {
        outputFile: `output${imageIndex}.bin`,
        exportType: 'dsk',
        dskFile: dskFilename
      })

      if (!result.success) {
        console.error(
          `[DSK Workspace] SCR assembly failed for ${image.name}:`,
          result.output
        )
        continue
      }

      console.log(`[DSK Workspace] Added ${scrFilename} to DSK`)
    }

    // Read the final DSK from virtual filesystem
    const dskData = readDsk(rasmModule, dskFilename)
    console.log(
      `[DSK Workspace] Successfully exported DSK with ${images.length} image(s)`
    )

    return dskData
  } catch (error) {
    console.error('[DSK Workspace] Error during DSK assembly:', error)
    return null
  }
}
