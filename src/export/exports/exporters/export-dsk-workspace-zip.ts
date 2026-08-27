import JSZip from 'jszip'
import { dskLogger } from '@/core'
import { type CpcModeConfig, isStandardScreen } from '@/domain/cpc'
import {
  generateClassicRasterASM,
  generatePlusRasterASM
} from '@/export/exports/raster-format'
import { generateDskFilenames } from '../dsk-workspace-utils'
import { generateDskReadmePdf } from '../generate-dsk-readme-pdf'
import { toASMData } from '../to-asm-data'
import type { DskImage } from '../types'
import { generateDskStandardScr, toDskModeConfig } from './dsk-image-format'
import { exportDskWorkspace } from './export-dsk-workspace'

type RasmInstance = Awaited<
  ReturnType<typeof import('@/libs/rasm-wasm').createRasmInstance>
>
type RasmModule = ReturnType<RasmInstance['getModule']>

/**
 * Initialize RASM instance for assembly
 */
async function initializeRasm(): Promise<{
  instance: RasmInstance | null
  module: RasmModule | null
}> {
  try {
    const { createRasmInstance } = await import('@/libs/rasm-wasm')
    const instance = await createRasmInstance()
    const module = instance.getModule()
    dskLogger.info('[DSK Workspace ZIP] RASM initialized for binary generation')
    return { instance, module }
  } catch (error) {
    dskLogger.warn(
      '[DSK Workspace ZIP] RASM not available, skipping binary generation:',
      error
    )
    return { instance: null, module: null }
  }
}

/**
 * Process and add linear chunks to ZIP
 */
async function processLinearChunks(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  imageIndex: number,
  image: DskImage,
  rasmInstance: RasmInstance | null,
  rasmModule: RasmModule | null
): Promise<void> {
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

    await addAssembledFile(
      zip,
      chunk.data,
      asmLabel,
      chunkFilename,
      rasmInstance,
      rasmModule
    )
  }
}

/**
 * Assemble and add file to ZIP (or add raw data if RASM unavailable)
 */
async function addAssembledFile(
  zip: JSZip,
  data: Uint8Array,
  asmLabel: string,
  zipFilename: string,
  rasmInstance: RasmInstance | null,
  rasmModule: RasmModule | null
): Promise<void> {
  const asmResult = toASMData(data, asmLabel)

  if (typeof asmResult === 'string' && rasmInstance && rasmModule) {
    try {
      const asmFilename = `${asmLabel}.asm`
      rasmModule.FS.writeFile(`/${asmFilename}`, asmResult)
      const assembleResult = await rasmInstance.assemble(asmResult, {
        outputFile: `${asmLabel}.bin`
      })

      if (assembleResult.success && assembleResult.binary) {
        zip.file(zipFilename, assembleResult.binary)
        dskLogger.info(`[DSK Workspace ZIP] Added ${zipFilename} to archive`)
      } else {
        dskLogger.warn(
          `[DSK Workspace ZIP] Failed to assemble ${zipFilename} to binary`
        )
      }
    } catch (error) {
      dskLogger.warn(
        `[DSK Workspace ZIP] Error assembling ${zipFilename}:`,
        error
      )
    }
  } else if (!rasmInstance || !rasmModule) {
    zip.file(zipFilename, data)
    dskLogger.info(
      `[DSK Workspace ZIP] Added ${zipFilename} to archive (fallback)`
    )
  }
}

/**
 * Add raster assembly file to ZIP if image has raster changes
 */
function addRasterFile(zip: JSZip, image: DskImage, imageIndex: number): void {
  if (!image.rasterChanges || image.rasterChanges.length === 0) return

  const rasterLabel = `raster${imageIndex}`
  const isCPCPlus = image.cpcHardware === 'plus'

  const basePalette = isCPCPlus
    ? (image.palettePlus ?? [])
    : image.paletteFirmware

  const rasterAsm = isCPCPlus
    ? generatePlusRasterASM(
        image.rasterChanges,
        image.height,
        basePalette,
        rasterLabel
      )
    : generateClassicRasterASM(
        image.rasterChanges,
        image.height,
        basePalette,
        rasterLabel
      )

  const rasterFilename = `raster${imageIndex}.asm`
  zip.file(rasterFilename, rasterAsm)
  dskLogger.info(
    `[DSK Workspace ZIP] Added ${rasterFilename} to archive (${image.rasterChanges.length} changes)`
  )
}

/**
 * Process single image and add to ZIP
 */
async function processImage(
  zip: JSZip,
  image: DskImage,
  imageIndex: number,
  rasmInstance: RasmInstance | null,
  rasmModule: RasmModule | null
): Promise<void> {
  const indexBuf = new Uint8Array(image.scrData)
  const modeConfig = toDskModeConfig(image)

  // Handle non-standard modes (linear format with chunks)
  if (!isStandardScreen(modeConfig)) {
    await processLinearChunks(
      zip,
      indexBuf,
      modeConfig,
      imageIndex,
      image,
      rasmInstance,
      rasmModule
    )
    addRasterFile(zip, image, imageIndex)
    return
  }

  // Handle standard SCR format
  const binaryData = generateDskStandardScr(indexBuf, modeConfig, image)

  const dskFilenames = generateDskFilenames(
    imageIndex,
    image.width,
    image.height,
    image.mode,
    image.overscan
  )
  const zipFilename = dskFilenames[0].replace(
    /\.(SCR|BIN)$/i,
    (_m, p1) => `.${p1.toLowerCase()}`
  )

  await addAssembledFile(
    zip,
    binaryData,
    `image${imageIndex}`,
    zipFilename,
    rasmInstance,
    rasmModule
  )

  addRasterFile(zip, image, imageIndex)
}

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

    // Create ZIP with DSK and README
    const zip = new JSZip()
    const dskFilename = 'pixsaur-workspace.dsk'

    zip.file(dskFilename, dskData)
    dskLogger.info('[DSK Workspace ZIP] Added DSK to archive')

    const readmePdf = generateDskReadmePdf(images, dskFilename)
    zip.file('README.pdf', readmePdf)
    dskLogger.info('[DSK Workspace ZIP] Added README.pdf to archive')

    // Initialize RASM for binary generation
    const { instance: rasmInstance, module: rasmModule } =
      await initializeRasm()

    // Process each image
    for (let i = 0; i < images.length; i++) {
      await processImage(zip, images[i], i + 1, rasmInstance, rasmModule)
    }

    // Generate final ZIP blob
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
