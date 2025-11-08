import JSZip from 'jszip'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { injectPaletteDataIntoSCR } from '@/palettes/cpc-palette'
import { injectCPCPlusPaletteIntoSCR } from '../cpc-plus-format'
import { exportSCR } from '../export-scr/export-scr'
import { generateDskReadme } from '../generate-dsk-readme'
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

    // Generate and add README
    const readme = generateDskReadme(images, dskFilename)
    zip.file('README.md', readme)
    console.log('[DSK Workspace ZIP] Added README.md to archive')

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

      // Convert index buffer to SCR format
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

      const scrData = exportSCR(indexBuf, modeConfig)

      // Inject palette based on hardware type
      if (image.cpcHardware === 'plus' && image.palettePlus) {
        injectCPCPlusPaletteIntoSCR(scrData, image.palettePlus)
        scrData[2034] = image.mode
      } else {
        injectPaletteDataIntoSCR(scrData, image.paletteFirmware, image.mode)
      }

      // Generate filename from image name (convert to AMSDOS format)
      const filename = image.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 8)

      // Add SCR file to ZIP
      zip.file(`${filename}.scr`, scrData)
      console.log(`[DSK Workspace ZIP] Added ${filename}.scr to archive`)

      // Generate ASM file and assemble to BIN
      const asmLabel = `image${imageIndex}`
      const asmResult = toASMData(scrData, asmLabel)

      if (typeof asmResult === 'string' && rasmInstance && rasmModule) {
        const asmFilename = `${filename}.asm`
        const binFilename = `${filename}.bin`

        try {
          // Write ASM to virtual filesystem
          rasmModule.FS.writeFile(`/${asmFilename}`, asmResult)

          // Assemble to binary (no exportType = binary output)
          const assembleResult = await rasmInstance.assemble(asmResult, {
            outputFile: binFilename
          })

          if (assembleResult.success && assembleResult.binary) {
            // Add BIN file to ZIP
            zip.file(binFilename, assembleResult.binary)
            console.log(`[DSK Workspace ZIP] Added ${binFilename} to archive`)
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
