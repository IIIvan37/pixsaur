/**
 * RASM WebAssembly Wrapper
 * Provides a clean TypeScript API to interact with the RASM Z80 assembler
 * compiled to WebAssembly via Emscripten.
 */

import { createLogger } from '@/utils/logger'
import type {
  AssembleOptions,
  AssembleResult,
  RasmInstance,
  RasmModule
} from './types'

const logger = createLogger({ prefix: '[RASM]' })

let rasmModulePromise: Promise<RasmModule> | null = null
// A simple serial queue to ensure we only call into Emscripten's
// module.callMain() and mutate module.print/module.printErr one at a time.
// Concurrent assembles mutate the same global module handlers and will
// interfere with each other if they run in parallel. This queue ensures
// assemble() invocations are executed serially.
let assemblyQueue: Promise<any> = Promise.resolve()
// Test helper: introduce an optional artificial delay to simulate long-running
// assembly steps. This helps unit testing of serialization and dispose()
// behavior without changing runtime behavior in production.
let TEST_ASSEMBLY_DELAY_MS = 0

export function __setTestAssemblyDelay(ms: number) {
  TEST_ASSEMBLY_DELAY_MS = ms
}

export function __waitForAssemblyIdle() {
  return assemblyQueue.then(() => undefined)
}

/**
 * Convert Emscripten FS readFile result to Uint8Array
 */
function toUint8Array(data: string | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) {
    return data
  }
  // If it's a string, it's likely an error - try to convert anyway
  return new Uint8Array(data as unknown as ArrayBuffer)
}

/**
 * Build RASM command-line arguments from options
 */
function buildRasmArgs(
  inputFile: string,
  options: {
    outputFile: string
    symbols: boolean
    symbolFile: string
    exportType?: 'snapshot' | 'cartridge' | 'dsk'
    snapshotFile: string
  }
): string[] {
  const args: string[] = [inputFile]

  // Binary output
  args.push('-ob', options.outputFile)

  // Symbol file
  if (options.symbols) {
    args.push('-s', '-os', options.symbolFile)
  }

  // Export formats
  if (options.exportType === 'snapshot') {
    args.push('-oi', options.snapshotFile)
  } else if (options.exportType === 'cartridge') {
    args.push('-oc', 'output.cpr')
  }

  return args
}

/**
 * Read output files after assembly
 */
function readOutputFiles(
  module: RasmModule,
  options: {
    outputFile: string
    symbols: boolean
    symbolFile: string
    exportType?: 'snapshot' | 'cartridge' | 'dsk'
    snapshotFile: string
    dskFile: string
  }
): {
  binary: Uint8Array | undefined
  symbolData: string | undefined
  snapshot: Uint8Array | undefined
  dsk: Uint8Array | undefined
} {
  let binary: Uint8Array | undefined
  let symbolData: string | undefined
  let snapshot: Uint8Array | undefined
  let dsk: Uint8Array | undefined

  // Read binary output
  try {
    const binaryData = module.FS.readFile(options.outputFile)
    binary = toUint8Array(binaryData)
    logger.debug('Binary read successfully, size:', binary.length)
  } catch (error) {
    logger.debug('Binary not generated:', error)
  }

  // Read symbol file
  if (options.symbols) {
    try {
      const symData = module.FS.readFile(options.symbolFile, {
        encoding: 'utf8'
      })
      symbolData = symData as string
      logger.debug('Symbols read successfully')
    } catch (error) {
      logger.debug('Symbol file not generated:', error)
    }
  }

  // Read snapshot
  if (options.exportType === 'snapshot') {
    try {
      const snaData = module.FS.readFile(options.snapshotFile)
      snapshot = toUint8Array(snaData)
      logger.debug('Snapshot read successfully, size:', snapshot.length)
    } catch (error) {
      logger.debug('Snapshot not generated:', error)
    }
  }

  // Read DSK
  if (options.exportType === 'dsk') {
    try {
      const dskData = module.FS.readFile(options.dskFile)
      dsk = toUint8Array(dskData)
      logger.debug('DSK read successfully, size:', dsk.length)
    } catch (error) {
      logger.debug('DSK not generated:', error)
    }
  }

  return { binary, symbolData, snapshot, dsk }
}

/**
 * Cleanup virtual filesystem files
 */
function cleanupFiles(
  module: RasmModule,
  files: {
    inputFile: string
    outputFile?: string
    symbolFile?: string
    snapshotFile?: string
  }
): void {
  try {
    module.FS.unlink(files.inputFile)
    if (files.outputFile) module.FS.unlink(files.outputFile)
    if (files.symbolFile) module.FS.unlink(files.symbolFile)
    if (files.snapshotFile) module.FS.unlink(files.snapshotFile)
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Load the RASM WebAssembly module
 */
async function loadRasmModule(): Promise<RasmModule> {
  if (rasmModulePromise) {
    logger.debug('Returning cached module')
    return rasmModulePromise
  }

  logger.debug('Loading module for the first time...')
  rasmModulePromise = new Promise((resolve, reject) => {
    // Load the Emscripten-generated JavaScript loader
    const script = document.createElement('script')
    script.src = '/wasm/rasm.js'
    script.async = true

    script.onload = async () => {
      logger.debug('Script loaded, initializing module...')
      try {
        // @ts-expect-error - createRasmModule is injected by Emscripten
        const createRasmModule = globalThis.createRasmModule

        if (!createRasmModule) {
          throw new Error('createRasmModule not found')
        }

        logger.debug('createRasmModule found, creating instance...')
        const module = (await createRasmModule({
          locateFile: (path: string) => {
            // Point to the WASM file in public/wasm/
            if (path.endsWith('.wasm')) {
              logger.debug('Locating WASM file:', '/wasm/rasm.wasm')
              return '/wasm/rasm.wasm'
            }
            return path
          },
          // Capture stdout/stderr
          print: (text: string) => {
            logger.debug(text)
          },
          printErr: (text: string) => {
            logger.error(text)
          }
        })) as RasmModule

        logger.debug('Module initialized successfully')
        resolve(module)
      } catch (error) {
        logger.error('Failed to initialize module:', error)
        reject(error)
      }
    }

    script.onerror = () => {
      logger.error('Failed to load script from /wasm/rasm.js')
      reject(new Error('Failed to load RASM module'))
    }

    document.head.appendChild(script)
  })

  return rasmModulePromise
}

/**
 * Create a new RASM instance
 */
export async function createRasmInstance(): Promise<RasmInstance> {
  const module = await loadRasmModule()

  return {
    isReady: () => !!module,

    getModule: () => module,

    assemble: async (
      code: string,
      options: AssembleOptions = {}
    ): Promise<AssembleResult> => {
      const {
        outputFile = 'output.bin',
        symbols = false,
        symbolFile = 'output.sym',
        exportType,
        snapshotFile = 'output.sna',
        dskFile = 'output.dsk'
      } = options

      // Prepare input file
      const inputFile = '/input.asm'

      // Run the actual assembly under a serial execution queue so
      // we don't mutate/restore module.print/printErr concurrently.
      const runAssembly = async (): Promise<AssembleResult> => {
        // Capture output
        let capturedOutput = ''
        const originalPrint = module.print
        const originalPrintErr = module.printErr

        module.print = (text: string) => {
          capturedOutput += `${text}\n`
          originalPrint?.(text)
        }

        module.printErr = (text: string) => {
          capturedOutput += `${text}\n`
          originalPrintErr?.(text)
        }

        try {
          // If a test delay is configured, yield for the requested time
          // before invoking callMain. This simulates a long-running
          // assembly step and allows tests to assert serialization.
          if (TEST_ASSEMBLY_DELAY_MS > 0) {
            await new Promise<void>((res) =>
              setTimeout(res, TEST_ASSEMBLY_DELAY_MS)
            )
          }
          // Write source code to virtual filesystem
          module.FS.writeFile(inputFile, code)

          // Build command-line arguments
          const args = buildRasmArgs(inputFile, {
            outputFile,
            symbols,
            symbolFile,
            exportType,
            snapshotFile
          })

          logger.debug('Calling with args:', args)

          // Call RASM
          const exitCode = module.callMain(args)
          logger.debug('Exit code:', exitCode)

          // Read output files
          const { binary, symbolData, snapshot, dsk } = readOutputFiles(
            module,
            {
              outputFile,
              symbols,
              symbolFile,
              exportType,
              snapshotFile,
              dskFile
            }
          )

          // Cleanup virtual filesystem
          cleanupFiles(module, {
            inputFile,
            outputFile: binary ? outputFile : undefined,
            symbolFile: symbolData ? symbolFile : undefined,
            snapshotFile: snapshot ? snapshotFile : undefined
          })

          // Restore output handlers
          module.print = originalPrint
          module.printErr = originalPrintErr

          return {
            success: exitCode === 0,
            binary,
            symbols: symbolData,
            snapshot,
            dsk,
            output: capturedOutput,
            exitCode
          }
        } catch (error) {
          // Restore output handlers
          module.print = originalPrint
          module.printErr = originalPrintErr

          const errorMessage =
            error instanceof Error ? error.message : String(error)
          return {
            success: false,
            output: `${capturedOutput}\nError: ${errorMessage}`,
            exitCode: -1
          }
        }
      }

      // Queue up the assembly operation to run serially.
      // This prevents race conditions on the Emscripten runtime module
      // (module.print/module.printErr) when multiple callers assemble
      // code at the same time.
      const queued = assemblyQueue.then(
        () => runAssembly(),
        () => runAssembly()
      )
      // Ensure the queue doesn't reject permanently; keep a resolved
      // promise chain to sequentialize future calls.
      assemblyQueue = queued.catch(() => undefined)
      return await queued
    },

    dispose: async () => {
      // Wait for any queued assembly operations to finish first.
      await assemblyQueue
      rasmModulePromise = null
    }
  }
}

/**
 * Convenience function to assemble Z80 code
 */
export async function assemble(
  code: string,
  options?: AssembleOptions
): Promise<AssembleResult> {
  logger.debug('assemble() called with code length:', code.length)
  logger.debug('options:', options)
  const rasm = await createRasmInstance()
  logger.debug('Instance created, calling assemble method...')
  const result = await rasm.assemble(code, options)
  logger.debug('Assembly completed')
  return result
}
