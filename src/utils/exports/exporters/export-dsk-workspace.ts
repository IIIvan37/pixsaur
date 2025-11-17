import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { generateDskFilenames } from '@/components/dsk-workspace/dsk-workspace-utils'
import { dskLogger } from '@/utils/core'
import {
  generateScrDskTemplate,
  generateUniversalScrLoader
} from '../templates'

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

    // Helper: assemble and add a single SCR file to the DSK
    async function addScrToDsk(
      rasmInstance: Awaited<
        ReturnType<typeof import('@/libs/rasm-wasm').createRasmInstance>
      >,
      rasmModule: ReturnType<
        Awaited<
          ReturnType<typeof import('@/libs/rasm-wasm').createRasmInstance>
        >['getModule']
      >,
      binary: Uint8Array,
      asmLabel: string,
      dskFilenameOnDisk: string,
      imageIndex: number,
      imageName: string
    ) {
      const scrBinFilename = `${asmLabel}.bin`

      // Write binary file to virtual filesystem
      rasmModule.FS.writeFile(`/${scrBinFilename}`, binary)

      dskLogger.info(`Created ${scrBinFilename} (${binary.length} bytes)`)

      // Generate DSK template code to save SCR to DSK using INCBIN
      const dskTemplateCode = generateScrDskTemplate({
        scrBinFilename,
        scrLabel: asmLabel,
        dskFilename,
        screenFilename: dskFilenameOnDisk
      })

      // Assemble and save SCR to DSK
      const result = await rasmInstance.assemble(dskTemplateCode, {
        outputFile: `output${imageIndex}.bin`,
        exportType: 'dsk',
        dskFile: dskFilename
      })

      if (!result.success) {
        dskLogger.error(`SCR assembly failed for ${imageName}:`, result.output)
        return false
      }

      dskLogger.info(`Added ${dskFilenameOnDisk} to DSK`)
      return true
    }

    // Helper: write chunks and add them to the DSK
    async function addChunksToDsk(
      rasmInstance: Awaited<
        ReturnType<typeof import('@/libs/rasm-wasm').createRasmInstance>
      >,
      rasmModule: ReturnType<
        Awaited<
          ReturnType<typeof import('@/libs/rasm-wasm').createRasmInstance>
        >['getModule']
      >,
      chunks: Array<{ index: number; data: Uint8Array }>,
      asmLabel: string,
      dskFilenames: string[],
      imageIndex: number,
      imageName: string
    ) {
      for (const chunk of chunks) {
        const chunkBinFilename = `${asmLabel}_${chunk.index}.bin`
        const chunkDskFilename = dskFilenames[chunk.index - 1]

        // Write chunk to virtual filesystem
        rasmModule.FS.writeFile(`/${chunkBinFilename}`, chunk.data)

        dskLogger.info(
          `Created ${chunkBinFilename} (${chunk.data.length} bytes)`
        )

        // Generate DSK template code to save chunk to DSK using INCBIN
        const dskTemplateCode = generateScrDskTemplate({
          scrBinFilename: chunkBinFilename,
          scrLabel: `${asmLabel}_${chunk.index}`,
          dskFilename,
          screenFilename: chunkDskFilename
        })

        // Assemble and save chunk to DSK
        const result = await rasmInstance.assemble(dskTemplateCode, {
          outputFile: `output${imageIndex}_${chunk.index}.bin`,
          exportType: 'dsk',
          dskFile: dskFilename
        })

        if (!result.success) {
          dskLogger.error(
            `Chunk ${chunk.index} assembly failed for ${imageName}:`,
            result.output || '(no error message)'
          )
          dskLogger.error('DSK Template Code:', dskTemplateCode)
        } else {
          dskLogger.info(`Added ${chunkDskFilename} to DSK`)
        }
      }
    }

    // Process each image (first one creates the DSK, others append to it)
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const imageIndex = i + 1
      const asmLabel = `image${imageIndex}`

      dskLogger.info(
        `Processing image ${imageIndex}/${images.length}: ${image.name}`
      )

      // Convert scrData array back to Uint8Array
      const indexBuf = new Uint8Array(image.scrData)

      // Generate SCR with appropriate palette format
      const modeConfig = {
        mode: image.mode,
        width: image.width,
        height: image.height,
        overscan: image.overscan,
        nColors: image.nColors,
        scaleX: image.scaleX,
        scaleY: image.scaleY
      }

      // Check if this is a standard SCR format or custom linear format
      const isStandardMode =
        !modeConfig.overscan &&
        ((modeConfig.mode === 0 &&
          modeConfig.width === 160 &&
          modeConfig.height === 200) ||
          (modeConfig.mode === 1 &&
            modeConfig.width === 320 &&
            modeConfig.height === 200) ||
          (modeConfig.mode === 2 &&
            modeConfig.width === 640 &&
            modeConfig.height === 200))

      let binaryData: Uint8Array
      let dskFilenameOnDisk: string

      if (isStandardMode) {
        // Standard SCR format with metadata
        const { exportSCR } = await import('../export-scr/export-scr')
        const scrData = exportSCR(indexBuf, modeConfig)

        // Inject palette based on hardware type
        if (image.cpcHardware === 'plus' && image.palettePlus) {
          const { injectCPCPlusPaletteIntoSCR } = await import(
            '../cpc-plus-format'
          )
          injectCPCPlusPaletteIntoSCR(scrData, image.palettePlus)
          scrData[2034] = image.mode
        } else {
          const { injectPaletteDataIntoSCR } = await import(
            '@/palettes/cpc-palette'
          )
          injectPaletteDataIntoSCR(scrData, image.paletteFirmware, image.mode)
        }

        binaryData = scrData
        const filenames = generateDskFilenames(
          imageIndex,
          image.width,
          image.height,
          image.mode,
          image.overscan
        )
        dskFilenameOnDisk = filenames[0] // IMG1.SCR
        dskLogger.info(
          `Generated standard SCR format (${binaryData.length} bytes)`
        )
      } else {
        // Custom dimensions - use linear format without metadata
        const { exportLinearAsm, splitLinearIntoChunks } = await import(
          '../export-linear-asm/export-linear.asm'
        )
        const linearData = exportLinearAsm(indexBuf, modeConfig)
        const chunks = splitLinearIntoChunks(linearData)

        dskLogger.info(
          `Generated linear format for custom dimensions (${linearData.length} bytes, ${chunks.length} chunk(s))`
        )

        // Generate all filenames for this image
        const dskFilenames = generateDskFilenames(
          imageIndex,
          image.width,
          image.height,
          image.mode,
          image.overscan
        )

        // Process chunked custom linear data and add to DSK
        await addChunksToDsk(
          rasmInstance,
          rasmModule,
          chunks,
          asmLabel,
          dskFilenames,
          imageIndex,
          image.name
        )

        // Skip the standard single-file logic below for chunked files
        continue
      }

      const scrBinFilename = `${asmLabel}.bin`

      // Write binary file to virtual filesystem
      rasmModule.FS.writeFile(`/${scrBinFilename}`, binaryData)

      dskLogger.info(`Created ${scrBinFilename} (${binaryData.length} bytes)`)

      // Assemble and save SCR to DSK (different helper handles template creation)
      const ok = await addScrToDsk(
        rasmInstance,
        rasmModule,
        binaryData,
        asmLabel,
        dskFilenameOnDisk,
        imageIndex,
        image.name
      )

      if (!ok) continue
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
