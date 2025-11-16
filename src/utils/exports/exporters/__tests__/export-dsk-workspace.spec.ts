import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'

// Variables used by the module factory; set per-test to control behavior
let createRasmInstanceImpl: any = async () => {
  throw new Error('[test] createRasmInstance not configured')
}
let readDskImpl: any = () => new Uint8Array([])

vi.mock('@/libs/rasm-wasm', () => ({
  createRasmInstance: (...args: any[]) => createRasmInstanceImpl(...args),
  readDsk: (...args: any[]) => readDskImpl(...args)
}))

// Do the same for export-linear-asm so dynamic imports can be configured per test
let exportLinearAsmImpl: any = () => new Uint8Array([])
let splitLinearIntoChunksImpl: any = () => []

vi.mock('../export-linear-asm/export-linear.asm', () => ({
  exportLinearAsm: (...args: any[]) => exportLinearAsmImpl(...args),
  splitLinearIntoChunks: (...args: any[]) => splitLinearIntoChunksImpl(...args)
}))

// Local helper - small mock of the RASM module and instance used in tests
function createMockRasmModule(files: Record<string, Uint8Array | string> = {}) {
  const virtualFS = new Map<string, Uint8Array | string>(Object.entries(files))

  return {
    FS: {
      writeFile: vi.fn((path: string, data: string | Uint8Array) => {
        virtualFS.set(path, data)
      }),
      readFile: vi.fn(
        (path: string, options?: { encoding?: 'utf8' | 'binary' }) => {
          const file = virtualFS.get(path)
          if (!file) throw new Error(`File not found: ${path}`)
          if (options?.encoding === 'utf8' && typeof file !== 'string') {
            return new TextDecoder().decode(file as Uint8Array)
          }
          return file
        }
      ),
      unlink: vi.fn((path: string) => {
        virtualFS.delete(path)
      })
    },
    callMain: vi.fn(() => 0),
    print: vi.fn(),
    printErr: vi.fn()
  }
}

describe('exportDskWorkspace', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns null when workspace is empty', async () => {
    const { exportDskWorkspace } = await import('../export-dsk-workspace')
    const result = await exportDskWorkspace([])
    expect(result).toBeNull()
  })

  it('assembles DSK for standard SCR images with RASM available', async () => {
    // Mock fetch to return a simple template DSK
    const template = new Uint8Array([0x01, 0x02, 0x03])
    globalThis.fetch = vi.fn(
      () =>
        Promise.resolve({ ok: true, arrayBuffer: async () => template }) as any
    )

    // Prepare RASM mocks
    const module = createMockRasmModule()
    const assemble = vi.fn(async () => ({ success: true, output: 'OK' }))
    createRasmInstanceImpl = vi.fn(async () => ({
      assemble,
      getModule: () => module
    }))
    readDskImpl = vi.fn(() => new Uint8Array([0xaa, 0xbb]))

    // Create a standard DSK image (mode 0, 160x200)
    const image = {
      id: '1',
      name: 'test',
      scrData: [0, 1, 2, 3],
      mode: 0 as 0,
      width: 160,
      height: 200,
      overscan: false,
      nColors: 4,
      scaleX: 1,
      scaleY: 1,
      cpcHardware: 'classic',
      paletteFirmware: [0, 1, 2, 3]
    } as DskImage

    const { exportDskWorkspace } = await import('../export-dsk-workspace')

    const result = await exportDskWorkspace([image])

    expect(result).toBeInstanceOf(Uint8Array)
    expect(createRasmInstanceImpl).toHaveBeenCalled()
    expect(module.FS.writeFile).toHaveBeenCalled()
    expect(readDskImpl).toHaveBeenCalled()
    // ensure loader and SCR assembly were attempted
    expect(assemble).toHaveBeenCalled()
  })

  it('handles chunked (linear) images by assembling chunks', async () => {
    // Mock fetch template
    const template = new Uint8Array([0x05, 0x06])
    globalThis.fetch = vi.fn(
      () =>
        Promise.resolve({ ok: true, arrayBuffer: async () => template }) as any
    )

    // Mock exportLinearAsm and splitLinearIntoChunks
    const linearData = new Uint8Array([1, 2, 3, 4, 5, 6])
    vi.mock('../export-linear-asm/export-linear.asm', () => ({
      exportLinearAsm: () => linearData,
      splitLinearIntoChunks: () => [{ index: 1, data: new Uint8Array([9, 9]) }]
    }))

    // RASM instance with assemble success
    const module = createMockRasmModule()
    const assemble = vi.fn(async () => ({ success: true, output: 'OK' }))
    createRasmInstanceImpl = vi.fn(async () => ({
      assemble,
      getModule: () => module
    }))
    readDskImpl = vi.fn(() => new Uint8Array([0xca, 0xfe]))
    exportLinearAsmImpl = () => linearData
    splitLinearIntoChunksImpl = () => [
      { index: 1, data: new Uint8Array([9, 9]) }
    ]

    // Custom dimensions to force linear flow
    const image = {
      id: '2',
      name: 'linear',
      scrData: [0, 1, 2],
      mode: 0 as 0,
      width: 200,
      height: 150,
      overscan: false,
      nColors: 4,
      scaleX: 1,
      scaleY: 1,
      cpcHardware: 'classic',
      paletteFirmware: [0]
    } as DskImage

    const { exportDskWorkspace } = await import('../export-dsk-workspace')

    const result = await exportDskWorkspace([image])

    expect(result).toBeInstanceOf(Uint8Array)
    // ensure we wrote a chunk binary to FS and attempted assembly for it
    expect(module.FS.writeFile).toHaveBeenCalled()
    expect(assemble).toHaveBeenCalled()
    expect(readDskImpl).toHaveBeenCalled()
  })

  it('returns null if universal loader assembly fails', async () => {
    globalThis.fetch = vi.fn(
      () =>
        Promise.resolve({
          ok: true,
          arrayBuffer: async () => new Uint8Array([0x01])
        }) as any
    )

    const module = createMockRasmModule()
    const assemble = vi.fn(async () => ({ success: false, output: 'FAIL' }))
    createRasmInstanceImpl = vi.fn(async () => ({
      assemble,
      getModule: () => module
    }))
    readDskImpl = vi.fn(() => new Uint8Array([0xff]))

    const image = {
      id: '3',
      name: 'badloader',
      scrData: [0],
      mode: 0 as 0,
      width: 160,
      height: 200,
      overscan: false,
      nColors: 2,
      scaleX: 1,
      scaleY: 1,
      cpcHardware: 'classic',
      paletteFirmware: [0]
    } as DskImage

    const { exportDskWorkspace } = await import('../export-dsk-workspace')
    const result = await exportDskWorkspace([image])
    expect(result).toBeNull()
  })
})
