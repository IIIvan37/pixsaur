/**
 * RASM WebAssembly Wrapper
 * Provides a clean TypeScript API to interact with the RASM Z80 assembler
 * compiled to WebAssembly via Emscripten.
 */

import type {
  AssembleOptions,
  AssembleResult,
  RasmInstance,
  RasmModule
} from './types'

let rasmModulePromise: Promise<RasmModule> | null = null

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
 * Load the RASM WebAssembly module
 */
async function loadRasmModule(): Promise<RasmModule> {
  if (rasmModulePromise) {
    console.log('[RASM] Returning cached module')
    return rasmModulePromise
  }

  console.log('[RASM] Loading module for the first time...')
  rasmModulePromise = new Promise((resolve, reject) => {
    // Load the Emscripten-generated JavaScript loader
    const script = document.createElement('script')
    script.src = '/wasm/rasm.js'
    script.async = true

    script.onload = async () => {
      console.log('[RASM] Script loaded, initializing module...')
      try {
        // @ts-expect-error - createRasmModule is injected by Emscripten
        const createRasmModule = globalThis.createRasmModule

        if (!createRasmModule) {
          throw new Error('createRasmModule not found')
        }

        console.log('[RASM] createRasmModule found, creating instance...')
        const module = (await createRasmModule({
          locateFile: (path: string) => {
            // Point to the WASM file in public/wasm/
            if (path.endsWith('.wasm')) {
              console.log('[RASM] Locating WASM file:', '/wasm/rasm.wasm')
              return '/wasm/rasm.wasm'
            }
            return path
          },
          // Capture stdout/stderr
          print: (text: string) => {
            console.log('[RASM]', text)
          },
          printErr: (text: string) => {
            console.error('[RASM]', text)
          }
        })) as RasmModule

        console.log('[RASM] Module initialized successfully')
        resolve(module)
      } catch (error) {
        console.error('[RASM] Failed to initialize module:', error)
        reject(error)
      }
    }

    script.onerror = () => {
      console.error('[RASM] Failed to load script from /wasm/rasm.js')
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
        // Write source code to virtual filesystem
        module.FS.writeFile(inputFile, code)

        // Build command-line arguments
        const args: string[] = [inputFile]

        // Binary output
        args.push('-ob', outputFile)

        // Symbol file
        if (symbols) {
          args.push('-s')
          args.push('-os', symbolFile)
        }

        // Export formats
        if (exportType === 'snapshot') {
          args.push('-oi', snapshotFile)
        } else if (exportType === 'cartridge') {
          args.push('-oc', 'output.cpr')
        }
        // Note: DSK export requires SAVE directive in the source code
        // We can't force DSK creation from command line alone

        console.log('[RASM] Calling with args:', args)

        // Call RASM
        const exitCode = module.callMain(args)
        console.log('[RASM] Exit code:', exitCode)

        // Read output files
        let binary: Uint8Array | undefined
        let symbolData: string | undefined
        let snapshot: Uint8Array | undefined
        let dsk: Uint8Array | undefined

        try {
          // Try to read binary output (defaults to binary mode)
          const binaryData = module.FS.readFile(outputFile)
          binary = toUint8Array(binaryData)
          console.log('[RASM] Binary read successfully, size:', binary.length)
        } catch (error) {
          console.log('[RASM] Binary not generated:', error)
          // Binary not generated (error during assembly)
        }

        if (symbols) {
          try {
            const symData = module.FS.readFile(symbolFile, {
              encoding: 'utf8'
            })
            symbolData = symData as string
            console.log('[RASM] Symbols read successfully')
          } catch (error) {
            console.log('[RASM] Symbol file not generated:', error)
            // Symbol file not generated
          }
        }

        if (exportType === 'snapshot') {
          try {
            const snaData = module.FS.readFile(snapshotFile)
            snapshot = toUint8Array(snaData)
            console.log(
              '[RASM] Snapshot read successfully, size:',
              snapshot.length
            )
          } catch (error) {
            console.log('[RASM] Snapshot not generated:', error)
            // Snapshot not generated
          }
        }

        if (exportType === 'dsk') {
          try {
            const dskData = module.FS.readFile(dskFile)
            dsk = toUint8Array(dskData)
            console.log('[RASM] DSK read successfully, size:', dsk.length)
          } catch (error) {
            console.log('[RASM] DSK not generated:', error)
            // DSK not generated
          }
        }

        // Cleanup virtual filesystem
        try {
          module.FS.unlink(inputFile)
          if (binary) module.FS.unlink(outputFile)
          if (symbolData) module.FS.unlink(symbolFile)
          if (snapshot) module.FS.unlink(snapshotFile)
          // Don't delete DSK file - it may be reused for multiple SAVE operations
          // if (dsk) module.FS.unlink(dskFile)
        } catch {
          // Ignore cleanup errors
        }

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
    },

    dispose: () => {
      // Cleanup if needed
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
  console.log('[RASM] assemble() called with code length:', code.length)
  console.log('[RASM] options:', options)
  const rasm = await createRasmInstance()
  console.log('[RASM] Instance created, calling assemble method...')
  const result = await rasm.assemble(code, options)
  console.log('[RASM] Assembly completed')
  return result
}
