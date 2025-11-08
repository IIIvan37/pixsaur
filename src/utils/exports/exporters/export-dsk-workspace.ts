import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { generateDskImageFilename } from '@/utils/amsdos-filename'
import { dskLogger } from '@/utils/logger'
import {
  generateScrDskTemplate,
  generateUniversalScrLoader
} from '../templates'
import { generateSCRAsmClassic, generateSCRAsmPlus } from './export-scr'

/**
 * Export DSK file from workspace images
 * Creates a DSK with multiple screen files from the workspace
 */
export async function exportDskWorkspace(
  images: DskImage[]
): Promise<Uint8Array | null> {
  if (images.length === 0) {
    dskLogger.warn('No images in workspace to export')
    return null
  }

  const dskFilename = 'pixsaur-workspace.dsk'

  try {
    // Create RASM instance and get access to the module
    const { createRasmInstance, readDsk } = await import('@/libs/rasm-wasm')
    const rasmInstance = await createRasmInstance()
    const rasmModule = rasmInstance.getModule()

    dskLogger.info(`Starting DSK export with ${images.length} image(s)`)

    // Load template DSK from public folder
    dskLogger.info('Loading template DSK from /pixsaur.dsk')
    const templateResponse = await fetch('/pixsaur.dsk')
    if (!templateResponse.ok) {
      dskLogger.error('Failed to load template DSK')
      return null
    }
    const templateDskData = new Uint8Array(await templateResponse.arrayBuffer())

    // Write template DSK to RASM virtual filesystem
    // RASM will add files to this existing DSK instead of creating a new one
    rasmModule.FS.writeFile(`/${dskFilename}`, templateDskData)
    dskLogger.info('Template DSK loaded, RASM will append files to it')

    // Generate and add universal loader to the DSK
    dskLogger.info('Adding universal loader to DSK')
    const loaderAsmCode = generateUniversalScrLoader(dskFilename)
    const loaderResult = await rasmInstance.assemble(loaderAsmCode, {
      outputFile: 'loader.bin',
      exportType: 'dsk',
      dskFile: dskFilename
    })

    if (!loaderResult.success) {
      dskLogger.error('Universal loader assembly failed:')
      dskLogger.error('RASM Output:', loaderResult.output)
      dskLogger.error('Generated ASM code:')
      dskLogger.error(loaderAsmCode)
      return null
    }

    dskLogger.info('Universal loader added successfully')

    // Process each image (first one creates the DSK, others append to it)
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const imageIndex = i + 1
      const scrFilename = generateDskImageFilename(imageIndex)
      const asmLabel = `image${imageIndex}`

      dskLogger.info(
        `Processing image ${imageIndex}/${images.length}: ${image.name}`
      )

      // Convert scrData array back to Uint8Array
      const scrData = new Uint8Array(image.scrData)

      // Generate SCR ASM content with appropriate palette format
      const modeConfig = {
        mode: image.mode,
        width: image.width,
        height: image.height,
        overscan: image.overscan,
        nColors: image.nColors,
        scaleX: image.scaleX,
        scaleY: image.scaleY
      }

      // Use appropriate generation function based on hardware type
      const scrAsmContent =
        image.cpcHardware === 'plus' && image.palettePlus
          ? generateSCRAsmPlus(scrData, modeConfig, image.palettePlus, asmLabel)
          : generateSCRAsmClassic(
              scrData,
              modeConfig,
              image.paletteFirmware,
              asmLabel
            )

      if (!scrAsmContent) {
        dskLogger.warn(`Skipping image ${image.name} - SCR data too large`)
        continue
      }

      const scrAsmFilename = `${asmLabel}.asm`

      // Write SCR ASM file to virtual filesystem
      rasmModule.FS.writeFile(`/${scrAsmFilename}`, scrAsmContent)

      // For workspace export, we only save the SCR files without loaders
      // Users can load them manually from BASIC or create their own loader

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
        dskLogger.error(`SCR assembly failed for ${image.name}:`, result.output)
        continue
      }

      dskLogger.info(`Added ${scrFilename} to DSK`)
    }

    // Read the final DSK from virtual filesystem
    const dskData = readDsk(rasmModule, dskFilename)
    dskLogger.info(`Successfully exported DSK with ${images.length} image(s)`)

    return dskData
  } catch (error) {
    dskLogger.error('Error during DSK assembly:', error)
    return null
  }
}
