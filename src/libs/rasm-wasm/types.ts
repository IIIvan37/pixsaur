/**
 * RASM WebAssembly Types
 * Type definitions for the RASM Z80 assembler running in WebAssembly
 */

export interface EmscriptenFS {
  writeFile: (path: string, data: string | Uint8Array) => void
  readFile: (
    path: string,
    options?: { encoding?: 'utf8' | 'binary' }
  ) => string | Uint8Array
  unlink: (path: string) => void
}

export interface RasmModule {
  FS: EmscriptenFS
  callMain: (args: string[]) => number
  print?: (text: string) => void
  printErr?: (text: string) => void
}

export interface AssembleOptions {
  /** Output binary file name (default: 'output.bin') */
  outputFile?: string
  /** Generate symbol file */
  symbols?: boolean
  /** Symbol file name (default: 'output.sym') */
  symbolFile?: string
  /** Export format: 'snapshot' for SNA, 'dsk' for disk image */
  exportType?: 'snapshot' | 'cartridge' | 'dsk'
  /** Snapshot filename for SNA export */
  snapshotFile?: string
  /** DSK filename for disk export */
  dskFile?: string
}

export interface AssembleResult {
  success: boolean
  /** Assembled binary data (if successful) */
  binary?: Uint8Array
  /** Symbol table (if requested) */
  symbols?: string
  /** Generated snapshot file (if requested) */
  snapshot?: Uint8Array
  /** Generated DSK file (if requested) */
  dsk?: Uint8Array
  /** Output from RASM (logs, errors, warnings) */
  output: string
  /** Exit code from RASM (0 = success) */
  exitCode: number
}

export interface RasmInstance {
  /** Assemble Z80 source code */
  assemble: (code: string, options?: AssembleOptions) => Promise<AssembleResult>
  /** Check if RASM module is ready */
  isReady: () => boolean
  /** Cleanup resources */
  dispose: () => void
}
