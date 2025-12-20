import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { generateDskFilenames } from '@/components/dsk-workspace/dsk-workspace-utils'
import { dskLogger } from '@/core'
import {
  generateScrDskTemplate,
  generateUniversalScrLoader
} from '@/export/exports/templates'

type RasmInstance = Awaited<
  ReturnType<typeof import('@/libs/rasm-wasm').createRasmInstance>
>
type RasmModule = ReturnType<RasmInstance['getModule']>

interface ModeConfig {
  mode: 0 | 1 | 2
  width: number
  height: number
  overscan: boolean
  nColors: number
  scaleX: number
  scaleY: number
}

interface AddScrToDskParams {
  rasmInstance: RasmInstance
  rasmModule: RasmModule
  binary: Uint8Array
  asmLabel: string
  dskFilename: string
  dskFilenameOnDisk: string
  imageIndex: number
  imageName: string
}

interface AddChunksToDskParams {
  rasmInstance: RasmInstance
  rasmModule: RasmModule
  chunks: Array<{ index: number; data: Uint8Array }>
  asmLabel: string
  dskFilename: string
  dskFilenames: string[]
  imageIndex: number
  imageName: string
}

interface ProcessImageParams {
  rasmInstance: RasmInstance
  rasmModule: RasmModule
  indexBuf: Uint8Array
  modeConfig: ModeConfig
  image: DskImage
  imageIndex: number
  asmLabel: string
  dskFilename: string
}

/**
 * Check if image uses standard CPC screen dimensions
 */
function isStandardMode(modeConfig: ModeConfig): boolean {
  if (modeConfig.overscan) {
    return false
  }

  const standardDimensions = [
    { mode: 0, width: 160, height: 200 },
    { mode: 1, width: 320, height: 200 },
    { mode: 2, width: 640, height: 200 }
  ]

  return standardDimensions.some(
    (standard) =>
      modeConfig.mode === standard.mode &&
      modeConfig.width === standard.width &&
      modeConfig.height === standard.height
  )
}

/**
 * Load template DSK file from public folder
 */
async function loadTemplateDsk(): Promise<Uint8Array | null> {
  dskLogger.info('Loading template DSK from /pixsaur.dsk')
  const templateResponse = await fetch('/pixsaur.dsk')

  if (!templateResponse.ok) {
    dskLogger.error('Failed to load template DSK')
    return null
  }

  return new Uint8Array(await templateResponse.arrayBuffer())
}

/**
 * Add universal loader to DSK
 */
async function addUniversalLoader(
  rasmInstance: RasmInstance,
  dskFilename: string
): Promise<boolean> {
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
    return false
  }

  dskLogger.info('Universal loader added successfully')
  return true
}

/**
 * Assemble and add a single SCR file to the DSK
 */
async function addScrToDsk(params: AddScrToDskParams): Promise<boolean> {
  const {
    rasmInstance,
    rasmModule,
    binary,
    asmLabel,
    dskFilename,
    dskFilenameOnDisk,
    imageIndex,
    imageName
  } = params

  const scrBinFilename = `${asmLabel}.bin`

  rasmModule.FS.writeFile(`/${scrBinFilename}`, binary)
  dskLogger.info(`Created ${scrBinFilename} (${binary.length} bytes)`)

  const dskTemplateCode = generateScrDskTemplate({
    scrBinFilename,
    scrLabel: asmLabel,
    dskFilename,
    screenFilename: dskFilenameOnDisk
  })

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

/**
 * Write chunks and add them to the DSK
 */
async function addChunksToDsk(params: AddChunksToDskParams): Promise<void> {
  const {
    rasmInstance,
    rasmModule,
    chunks,
    asmLabel,
    dskFilename,
    dskFilenames,
    imageIndex,
    imageName
  } = params

  for (const chunk of chunks) {
    const chunkBinFilename = `${asmLabel}_${chunk.index}.bin`
    const chunkDskFilename = dskFilenames[chunk.index - 1]

    rasmModule.FS.writeFile(`/${chunkBinFilename}`, chunk.data)
    dskLogger.info(`Created ${chunkBinFilename} (${chunk.data.length} bytes)`)

    const dskTemplateCode = generateScrDskTemplate({
      scrBinFilename: chunkBinFilename,
      scrLabel: `${asmLabel}_${chunk.index}`,
      dskFilename,
      screenFilename: chunkDskFilename
    })

    const result = await rasmInstance.assemble(dskTemplateCode, {
      outputFile: `output${imageIndex}_${chunk.index}.bin`,
      exportType: 'dsk',
      dskFile: dskFilename
    })

    if (result.success) {
      dskLogger.info(`Added ${chunkDskFilename} to DSK`)
    } else {
      dskLogger.error(
        `Chunk ${chunk.index} assembly failed for ${imageName}:`,
        result.output || '(no error message)'
      )
      dskLogger.error('DSK Template Code:', dskTemplateCode)
    }
  }
}

/**
 * Generate standard SCR format with palette injection
 */
async function generateStandardScr(
  indexBuf: Uint8Array,
  modeConfig: ModeConfig,
  image: DskImage
): Promise<Uint8Array> {
  const { exportSCR } = await import('@/export/exports/export-scr/export-scr')
  const scrData = exportSCR(indexBuf, modeConfig)

  if (image.cpcHardware === 'plus' && image.palettePlus) {
    const { injectCPCPlusPaletteIntoSCR } = await import('@/export')
    injectCPCPlusPaletteIntoSCR(scrData, image.palettePlus)
    scrData[2034] = image.mode
  } else {
    const { injectPaletteDataIntoSCR } = await import(
      '@/export/exports/cpc-format'
    )
    injectPaletteDataIntoSCR(scrData, image.paletteFirmware, image.mode)
  }

  return scrData
}

/**
 * Process custom dimensions image with linear format
 */
async function processCustomImage(params: ProcessImageParams): Promise<void> {
  const {
    rasmInstance,
    rasmModule,
    indexBuf,
    modeConfig,
    image,
    imageIndex,
    asmLabel,
    dskFilename
  } = params

  const { exportLinearAsm, splitLinearIntoChunks } = await import(
    '@/export/exports/export-linear-asm/export-linear.asm'
  )
  const linearData = exportLinearAsm(indexBuf, modeConfig)
  const chunks = splitLinearIntoChunks(linearData)

  dskLogger.info(
    `Generated linear format for custom dimensions (${linearData.length} bytes, ${chunks.length} chunk(s))`
  )

  const dskFilenames = generateDskFilenames(
    imageIndex,
    image.width,
    image.height,
    image.mode,
    image.overscan
  )

  await addChunksToDsk({
    rasmInstance,
    rasmModule,
    chunks,
    asmLabel,
    dskFilename,
    dskFilenames,
    imageIndex,
    imageName: image.name
  })
}

/**
 * Process standard format image
 */
async function processStandardImage(params: ProcessImageParams): Promise<void> {
  const {
    rasmInstance,
    rasmModule,
    indexBuf,
    modeConfig,
    image,
    imageIndex,
    asmLabel,
    dskFilename
  } = params

  const binaryData = await generateStandardScr(indexBuf, modeConfig, image)

  const filenames = generateDskFilenames(
    imageIndex,
    image.width,
    image.height,
    image.mode,
    image.overscan
  )
  const dskFilenameOnDisk = filenames[0]

  dskLogger.info(`Generated standard SCR format (${binaryData.length} bytes)`)

  const scrBinFilename = `${asmLabel}.bin`
  rasmModule.FS.writeFile(`/${scrBinFilename}`, binaryData)
  dskLogger.info(`Created ${scrBinFilename} (${binaryData.length} bytes)`)

  await addScrToDsk({
    rasmInstance,
    rasmModule,
    binary: binaryData,
    asmLabel,
    dskFilename,
    dskFilenameOnDisk,
    imageIndex,
    imageName: image.name
  })
}

/**
 * Process a single image and add it to the DSK
 */
async function processImage(
  rasmInstance: RasmInstance,
  rasmModule: RasmModule,
  image: DskImage,
  imageIndex: number,
  dskFilename: string
): Promise<void> {
  const asmLabel = `image${imageIndex}`

  dskLogger.info(`Processing image ${imageIndex}: ${image.name}`)

  const indexBuf = new Uint8Array(image.scrData)
  const modeConfig: ModeConfig = {
    mode: image.mode,
    width: image.width,
    height: image.height,
    overscan: image.overscan,
    nColors: image.nColors,
    scaleX: image.scaleX,
    scaleY: image.scaleY
  }

  if (isStandardMode(modeConfig)) {
    await processStandardImage({
      rasmInstance,
      rasmModule,
      indexBuf,
      modeConfig,
      image,
      imageIndex,
      asmLabel,
      dskFilename
    })
  } else {
    await processCustomImage({
      rasmInstance,
      rasmModule,
      indexBuf,
      modeConfig,
      image,
      imageIndex,
      asmLabel,
      dskFilename
    })
  }
}

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
    const { createRasmInstance, readDsk } = await import('@/libs/rasm-wasm')
    const rasmInstance = await createRasmInstance()
    const rasmModule = rasmInstance.getModule()

    dskLogger.info(`Starting DSK export with ${images.length} image(s)`)

    const templateDskData = await loadTemplateDsk()
    if (!templateDskData) {
      return null
    }

    rasmModule.FS.writeFile(`/${dskFilename}`, templateDskData)
    dskLogger.info('Template DSK loaded, RASM will append files to it')

    const loaderAdded = await addUniversalLoader(rasmInstance, dskFilename)
    if (!loaderAdded) {
      return null
    }

    for (let i = 0; i < images.length; i++) {
      await processImage(
        rasmInstance,
        rasmModule,
        images[i],
        i + 1,
        dskFilename
      )
    }

    const dskData = readDsk(rasmModule, dskFilename)
    dskLogger.info(`Successfully exported DSK with ${images.length} image(s)`)

    return dskData
  } catch (error) {
    dskLogger.error('Error during DSK assembly:', error)
    return null
  }
}
