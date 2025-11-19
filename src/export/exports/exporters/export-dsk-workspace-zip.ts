import JSZip from 'jszip'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { generateDskFilenames } from '@/components/dsk-workspace/dsk-workspace-utils'
import { dskLogger } from '@/core'
import { injectPaletteDataIntoSCR } from '@/export/exports/cpc-format'
import { injectCPCPlusPaletteIntoSCR } from '@/export/exports/cpc-plus-format'
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
    dskLogger.warn('No images in workspace to export')
    return null
  }

  try {
    dskLogger.info('[DSK Workspace ZIP] Starting ZIP export')

    // Generate DSK file
    const dskData = await exportDskWorkspace(images)
    if (!dskData) {
      dskLogger.error('[DSK Workspace ZIP] Failed to generate DSK')
      return null
    }

    // Create ZIP
    const zip = new JSZip()
    const dskFilename = 'pixsaur-workspace.dsk'

    // Add DSK file to ZIP
    zip.file(dskFilename, dskData)
    dskLogger.info('[DSK Workspace ZIP] Added DSK to archive')

    // Generate and add README PDF
    const readmePdf = generateDskReadmePdf(images, dskFilename)
    zip.file('README.pdf', readmePdf)
    dskLogger.info('[DSK Workspace ZIP] Added README.pdf to archive')

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
      dskLogger.info(
        '[DSK Workspace ZIP] RASM initialized for binary generation'
      )
    } catch (error) {
      dskLogger.warn(
        '[DSK Workspace ZIP] RASM not available, skipping binary generation:',
        error
      )
    }

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const imageIndex = i + 1

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
        const scrData = exportSCR(indexBuf, modeConfig)

        if (image.cpcHardware === 'plus' && image.palettePlus) {
          injectCPCPlusPaletteIntoSCR(scrData, image.palettePlus)
          scrData[2034] = image.mode
        } else {
          injectPaletteDataIntoSCR(scrData, image.paletteFirmware, image.mode)
        }

        binaryData = scrData
      } else {
        const { exportLinearAsm, splitLinearIntoChunks } = await import(
          '../export-linear-asm/export-linear.asm'
        )
        const linearData = exportLinearAsm(indexBuf, modeConfig)
        const chunks = splitLinearIntoChunks(linearData)

        const dskFilenames = generateDskFilenames(
          imageIndex,
          image.width,
          image.height,
          image.mode,
          image.overscan
        )

        for (const chunk of chunks) {
          const asmLabel = `image${imageIndex}_${chunk.index}`
          const chunkDskFilename = dskFilenames[chunk.index - 1]
          const chunkFilename = chunkDskFilename.replace(
            /\.(BIN)$/i,
            (_m, p1) => `.${p1.toLowerCase()}`
          )

          const asmResult = toASMData(chunk.data, asmLabel)

          if (typeof asmResult === 'string' && rasmInstance && rasmModule) {
            try {
              const asmFilename = `${asmLabel}.asm`
              rasmModule.FS.writeFile(`/${asmFilename}`, asmResult)
              const assembleResult = await rasmInstance.assemble(asmResult, {
                outputFile: `${asmLabel}.bin`
              })

              if (assembleResult.success && assembleResult.binary) {
                zip.file(chunkFilename, assembleResult.binary)
                dskLogger.info(
                  `[DSK Workspace ZIP] Added ${chunkFilename} to archive`
                )
              } else {
                dskLogger.warn(
                  `[DSK Workspace ZIP] Failed to assemble ${chunkFilename} to binary`
                )
              }
            } catch (error) {
              dskLogger.warn(
                `[DSK Workspace ZIP] Error assembling ${chunkFilename}:`,
                error
              )
            }
          } else if (!rasmInstance || !rasmModule) {
            zip.file(chunkFilename, chunk.data)
            dskLogger.info(
              `[DSK Workspace ZIP] Added ${chunkFilename} to archive (fallback)`
            )
          }
        }

        continue
      }

      const dskFilenames = generateDskFilenames(
        imageIndex,
        image.width,
        image.height,
        image.mode,
        image.overscan
      )
      const filename = dskFilenames[0].replace(/\.(SCR|BIN)$/i, '')

      const asmLabel = `image${imageIndex}`
      const asmResult = toASMData(binaryData, asmLabel)

      if (typeof asmResult === 'string' && rasmInstance && rasmModule) {
        try {
          const asmFilename = `${asmLabel}.asm`
          const binFilename = `${filename}.bin`
          rasmModule.FS.writeFile(`/${asmFilename}`, asmResult)
          const assembleResult = await rasmInstance.assemble(asmResult, {
            outputFile: binFilename
          })

          if (assembleResult.success && assembleResult.binary) {
            const zipFilename = dskFilenames[0].replace(
              /\.(SCR|BIN)$/i,
              (_m, p1) => `.${p1.toLowerCase()}`
            )
            zip.file(zipFilename, assembleResult.binary)
            dskLogger.info(
              `[DSK Workspace ZIP] Added ${dskFilenames[0]} to archive`
            )
          } else {
            dskLogger.warn(
              `[DSK Workspace ZIP] Failed to assemble ${filename} to binary`
            )
          }
        } catch (error) {
          dskLogger.warn(
            `[DSK Workspace ZIP] Error assembling ${filename}:`,
            error
          )
        }
      } else if (!rasmInstance || !rasmModule) {
        const zipFilename = dskFilenames[0].replace(
          /\.(SCR|BIN)$/i,
          (_m, p1) => `.${p1.toLowerCase()}`
        )
        zip.file(zipFilename, binaryData)
        dskLogger.info(
          `[DSK Workspace ZIP] Added ${dskFilenames[0]} to archive (fallback)`
        )
      }
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    })
    dskLogger.info('[DSK Workspace ZIP] ZIP export completed successfully')
    return zipBlob
  } catch (error) {
    dskLogger.error('[DSK Workspace ZIP] Error during ZIP export:', error)
    return null
  }
}
