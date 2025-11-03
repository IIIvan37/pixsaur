/**
 * RASM WebAssembly Integration
 * Z80 assembler running in the browser
 */

export { assemble, createRasmInstance } from './rasm-wasm'
export type {
  AssembleOptions,
  AssembleResult,
  RasmInstance,
  RasmModule
} from './types'
