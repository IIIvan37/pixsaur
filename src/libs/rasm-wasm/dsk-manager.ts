/**
 * DSK Manager
 * Helper functions to create and manage DSK disk images using RASM
 */

import type { RasmModule } from './types'

export interface DskFile {
  name: string
  data: Uint8Array
  loadAddress?: number
  execAddress?: number
}

export interface CreateDskOptions {
  /** DSK filename (default: 'disk.dsk') */
  filename?: string
  /** Disk format: 'data' or 'vendor' (default: 'data') */
  format?: 'data' | 'vendor'
}

import { dskLogger } from '@/utils/logger'

export interface AddFileToDskOptions {
  /** Load address in memory (optional) */
  loadAddress?: number
  /** Execution address (optional) */
  execAddress?: number
  /** AMSDOS file type (default: binary) */
  fileType?: 'basic' | 'binary' | 'ascii'
}

/**
 * Create a new empty DSK file in the RASM virtual filesystem
 */
export function createDsk(
  module: RasmModule,
  options: CreateDskOptions = {}
): string {
  const { filename = 'disk.dsk', format = 'data' } = options

  // Generate Z80 code that creates an empty DSK
  const code = `
    ; Create empty DSK file
    ORG #4000
    SAVE "${filename}",DSK,"${format}"
  `

  // Write the code to a temporary file
  const tempFile = '/create_dsk.asm'
  module.FS.writeFile(tempFile, code)

  // Assemble to create the DSK
  const args = [tempFile]
  const exitCode = module.callMain(args)

  // Cleanup temp file
  try {
    module.FS.unlink(tempFile)
  } catch {
    // Ignore
  }

  if (exitCode !== 0) {
    throw new Error(`Failed to create DSK: exit code ${exitCode}`)
  }

  dskLogger.info(`[DSK] Created empty DSK: ${filename}`)
  return filename
}

/**
 * Add a file to an existing DSK in the RASM virtual filesystem
 */
export function addFileToDsk(
  module: RasmModule,
  dskFilename: string,
  file: DskFile,
  options: AddFileToDskOptions = {}
): void {
  const { loadAddress, execAddress } = options

  // Write the file data to the virtual filesystem
  const dataFilename = `/temp_${file.name}`
  module.FS.writeFile(dataFilename, file.data)

  // Build the SAVE directive
  let saveDirective = `SAVE "${file.name}"`

  // Add load address if specified
  if (loadAddress !== undefined) {
    saveDirective += `,#${loadAddress.toString(16)}`
  }

  // Add length
  saveDirective += `,#${file.data.length.toString(16)}`

  // Add DSK format with disk filename
  saveDirective += `,DSK,"${dskFilename}"`

  // Add execution address if specified
  if (execAddress !== undefined) {
    saveDirective += `,#${execAddress.toString(16)}`
  }

  // Generate Z80 code that adds the file to DSK
  const code = `
    ; Add file to DSK
    ORG #4000
    INCBIN "${dataFilename}"
    ${saveDirective}
  `

  // Write the code to a temporary file
  const tempFile = '/add_to_dsk.asm'
  module.FS.writeFile(tempFile, code)

  // Assemble to add the file to DSK
  const args = [tempFile]
  const exitCode = module.callMain(args)

  // Cleanup temp files
  try {
    module.FS.unlink(tempFile)
    module.FS.unlink(dataFilename)
  } catch {
    // Ignore
  }

  if (exitCode !== 0) {
    throw new Error(
      `Failed to add file ${file.name} to DSK: exit code ${exitCode}`
    )
  }

  dskLogger.info(`[DSK] Added file to DSK: ${file.name}`)
}

/**
 * Read a DSK file from the RASM virtual filesystem
 */
export function readDsk(module: RasmModule, filename: string): Uint8Array {
  try {
    const data = module.FS.readFile(filename)
    if (data instanceof Uint8Array) {
      return data
    }
    // Convert if needed
    return new Uint8Array(data as unknown as ArrayBuffer)
  } catch (error) {
    throw new Error(
      `Failed to read DSK file ${filename}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Delete a DSK file from the RASM virtual filesystem
 */
export function deleteDsk(module: RasmModule, filename: string): void {
  try {
    module.FS.unlink(filename)
    dskLogger.info(`[DSK] Deleted DSK: ${filename}`)
  } catch (error) {
    dskLogger.warn(
      `[DSK] Failed to delete DSK ${filename}:`,
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * High-level function to create a DSK with multiple files
 */
export async function createDskWithFiles(
  module: RasmModule,
  files: Array<DskFile & AddFileToDskOptions>,
  options: CreateDskOptions = {}
): Promise<Uint8Array> {
  const dskFilename = options.filename || 'disk.dsk'

  // Create empty DSK
  createDsk(module, options)

  // Add all files
  for (const file of files) {
    const { name, data, loadAddress, execAddress, fileType } = file
    addFileToDsk(
      module,
      dskFilename,
      { name, data, loadAddress, execAddress },
      { loadAddress, execAddress, fileType }
    )
  }

  // Read and return the DSK
  return readDsk(module, dskFilename)
}
