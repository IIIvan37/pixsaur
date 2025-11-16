import JSZip from 'jszip'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { injectPaletteDataIntoSCR } from '@/palettes/cpc-palette'
import { injectCPCPlusPaletteIntoSCR } from '../cpc-plus-format'
import { exportSCR } from '../export-scr/export-scr'
import { generateDskReadmePdf } from '../generate-dsk-readme-pdf'
import { toASMData } from '../to-asm-data'
import { exportDskWorkspace } from './export-dsk-workspace'

/**
 * Export DSK workspace as a ZIP file containing the DSK and a README
 */
export async function exportDskWorkspaceZip(
  images: DskImage[]
): Promise<Blob | null> {
  if (images.length === 0) {
    console.warn('No images in workspace to export')
    return null
  }

  try {
    console.log('[DSK Workspace ZIP] Starting ZIP export')

    // Generate DSK file
    const dskData = await exportDskWorkspace(images)
    if (!dskData) {
      console.error('[DSK Workspace ZIP] Failed to generate DSK')
      return null
    }

    // Create ZIP
    const zip = new JSZip()
    const dskFilename = 'pixsaur-workspace.dsk'

    // Add DSK file to ZIP
    zip.file(dskFilename, dskData)
    console.log('[DSK Workspace ZIP] Added DSK to archive')

    // Generate and add README PDF
    const readmePdf = generateDskReadmePdf(images, dskFilename)
    zip.file('README.pdf', readmePdf)
    console.log('[DSK Workspace ZIP] Added README.pdf to archive')

    // Add individual SCR files and BIN files
    // Try to create RASM instance for binary generation (may fail in test environment)
    let rasmInstance: Awaited<
      ReturnType<typeof import('@/libs/rasm-wasm').createRasmInstance>
    > | null = null
    let rasmModule: ReturnType<
      Awaited<
        ReturnType<typeof import('@/libs/rasm-wasm').createRasmInstance>
      >['getModule']
    > | null = null

    try {
      const { createRasmInstance } = await import('@/libs/rasm-wasm')
      rasmInstance = await createRasmInstance()
      rasmModule = rasmInstance.getModule()
      console.log('[DSK Workspace ZIP] RASM initialized for binary generation')
    } catch (error) {
      console.warn(
        '[DSK Workspace ZIP] RASM not available, skipping binary generation:',
        error
      )
    }

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const imageIndex = i + 1

      // Convert index buffer
      const indexBuf = new Uint8Array(image.scrData)
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

      if (isStandardMode) {
        // Standard SCR format
        const scrData = exportSCR(indexBuf, modeConfig)

        // Inject palette based on hardware type
        if (image.cpcHardware === 'plus' && image.palettePlus) {
          injectCPCPlusPaletteIntoSCR(scrData, image.palettePlus)
          scrData[2034] = image.mode
        } else {
          injectPaletteDataIntoSCR(scrData, image.paletteFirmware, image.mode)
        }

        binaryData = scrData
      } else {
        // Custom dimensions - use linear format
        const { exportLinearAsm, splitLinearIntoChunks } = await import(
          '../export-linear-asm/export-linear.asm'
        )
        const linearData = exportLinearAsm(indexBuf, modeConfig)
        const chunks = splitLinearIntoChunks(linearData)

        console.log(
          `[DSK Workspace ZIP] Generated linear format for custom dimensions (${linearData.length} bytes, ${chunks.length} chunk(s))`
        )

        // Use same filename format as DSK: IMG00001.BIN, IMG00001_1.BIN, etc.
        const paddedIndex = imageIndex.toString().padStart(5, '0')

        // Process each chunk
        for (const chunk of chunks) {
          const asmLabel = `image${imageIndex}_${chunk.index}`
          const chunkFilename =
            chunks.length === 1
              ? `IMG${paddedIndex}.bin`
              : `IMG${paddedIndex}_${chunk.index}.bin`

          const asmResult = toASMData(chunk.data, asmLabel)

          if (typeof asmResult === 'string' && rasmInstance && rasmModule) {
            const asmFilename = `${asmLabel}.asm`
            const binFilename = `${asmLabel}.bin`

            try {
              // Write ASM to virtual filesystem
              rasmModule.FS.writeFile(`/${asmFilename}`, asmResult)

              // Assemble to binary (no exportType = binary output)
              const assembleResult = await rasmInstance.assemble(asmResult, {
                outputFile: binFilename
              })

              if (assembleResult.success && assembleResult.binary) {
                // Add BIN chunk to ZIP
                zip.file(chunkFilename, assembleResult.binary)
                console.log(
                  `[DSK Workspace ZIP] Added ${chunkFilename} to archive`
                )
              } else {
                console.warn(
                  `[DSK Workspace ZIP] Failed to assemble ${chunkFilename} to binary`
                )
              }
            } catch (error) {
              console.warn(
                `[DSK Workspace ZIP] Error assembling ${chunkFilename}:`,
                error
              )
            }
          } else if (!rasmInstance || !rasmModule) {
            // Fallback: if RASM not available, add raw binary data
            zip.file(chunkFilename, chunk.data)
            console.log(
              `[DSK Workspace ZIP] Added ${chunkFilename} to archive (fallback)`
            )
          }
        }

        // Skip the standard single-file logic for chunked files
        continue
      }

      // Use same filename format as DSK: IMG00001.SCR
      const paddedIndex = imageIndex.toString().padStart(5, '0')
      // Filename uses the same pattern for standard and custom modes
      const filename = `IMG${paddedIndex}`

      // Generate ASM file and assemble to BIN, then save as .scr or .bin
      const asmLabel = `image${imageIndex}`
      const asmResult = toASMData(binaryData, asmLabel)

      if (typeof asmResult === 'string' && rasmInstance && rasmModule) {
        const asmFilename = `${filename}.asm`
        const binFilename = `${filename}.bin`
        // Use .scr extension for standard format, .bin for custom
        const outputFilename = isStandardMode
          ? `${filename}.scr`
          : `${filename}.bin`

        try {
          // Write ASM to virtual filesystem
          rasmModule.FS.writeFile(`/${asmFilename}`, asmResult)

          // Assemble to binary (no exportType = binary output)
          const assembleResult = await rasmInstance.assemble(asmResult, {
            outputFile: binFilename
          })

          if (assembleResult.success && assembleResult.binary) {
            // Add BIN file to ZIP
            zip.file(outputFilename, assembleResult.binary)
            console.log(
              `[DSK Workspace ZIP] Added ${outputFilename} to archive`
            )
          } else {
            console.warn(
              `[DSK Workspace ZIP] Failed to assemble ${filename} to binary`
            )
          }
        } catch (error) {
          console.warn(
            `[DSK Workspace ZIP] Error assembling ${filename}:`,
            error
          )
        }
      } else if (!rasmInstance || !rasmModule) {
        // Fallback: if RASM not available, add raw binary data
        const outputFilename = isStandardMode
          ? `${filename}.scr`
          : `${filename}.bin`
        zip.file(outputFilename, binaryData)
        console.log(
          `[DSK Workspace ZIP] Added ${outputFilename} to archive (fallback)`
        )
      }
    }

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    })

    console.log('[DSK Workspace ZIP] ZIP export completed successfully')
    return zipBlob
  } catch (error) {
    console.error('[DSK Workspace ZIP] Error during ZIP export:', error)
    return null
  }
}
