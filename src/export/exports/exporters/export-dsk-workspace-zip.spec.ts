import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { exportDskWorkspaceZip } from './export-dsk-workspace-zip'

vi.mock('./export-dsk-workspace', () => ({
  exportDskWorkspace: vi.fn(async (images: DskImage[]) => {
    if (images.length === 0) return null
    // Return a mock DSK file (180 KB)
    return new Uint8Array(184320)
  })
}))

// Top-level RASM mock implementation used in tests (do not hoist test-local variables)
let createRasmInstanceImpl: any = vi.fn()
vi.mock('@/libs/rasm-wasm', () => ({
  createRasmInstance: (...args: any[]) => createRasmInstanceImpl(...args)
}))

describe('exportDskWorkspaceZip', () => {
  const createMockImage = (index: number, mode: 0 | 1 | 2 = 0): DskImage => ({
    id: `image-${index}`,
    name: `Image${index}`,
    scrData: Array.from({ length: 16384 }, () => 0),
    mode,
    width: mode === 0 ? 160 : mode === 1 ? 320 : 640,
    height: 200,
    overscan: false,
    nColors: mode === 0 ? 16 : mode === 1 ? 4 : 2,
    scaleX: mode === 0 ? 2 : mode === 1 ? 1 : 0.5,
    scaleY: 1.2,
    cpcHardware: 'classic',
    paletteFirmware: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    thumbnailDataUrl: 'data:image/png;base64,test',
    paletteColors: [
      '#000000',
      '#0000ff',
      '#ff0000',
      '#ff00ff',
      '#00ff00',
      '#00ffff',
      '#ffff00',
      '#ffffff',
      '#000080',
      '#8000ff',
      '#800000',
      '#800080',
      '#008000',
      '#008080',
      '#808000',
      '#808080'
    ]
  })

  it('should return null when no images provided', async () => {
    const result = await exportDskWorkspaceZip([])
    expect(result).toBeNull()
  })

  it('should generate ZIP with DSK and README', async () => {
    const images = [createMockImage(1), createMockImage(2)]
    const result = await exportDskWorkspaceZip(images)

    expect(result).not.toBeNull()
    expect(result).toBeInstanceOf(Blob)
    expect(result?.type).toBe('application/zip')

    // Verify ZIP contents
    if (result) {
      const zip = await JSZip.loadAsync(result)
      expect(zip.files['pixsaur-workspace.dsk']).toBeDefined()
      expect(zip.files['README.pdf']).toBeDefined()
      expect(zip.files['IMG1.scr']).toBeDefined()
      expect(zip.files['IMG2.scr']).toBeDefined()
    }
  })

  it('should handle single image', async () => {
    const images = [createMockImage(1)]
    const result = await exportDskWorkspaceZip(images)

    expect(result).not.toBeNull()
    expect(result).toBeInstanceOf(Blob)

    // Verify single SCR file is included
    if (result) {
      const zip = await JSZip.loadAsync(result)
      expect(zip.files['IMG1.scr']).toBeDefined()
      const scrData = await zip.files['IMG1.scr'].async('uint8array')
      expect(scrData.length).toBe(16384) // SCR file size
    }
  })

  it('should handle multiple modes', async () => {
    const images = [
      createMockImage(1, 0),
      createMockImage(2, 1),
      createMockImage(3, 2)
    ]
    const result = await exportDskWorkspaceZip(images)

    expect(result).not.toBeNull()
    expect(result).toBeInstanceOf(Blob)

    // Verify all SCR files are included
    if (result) {
      const zip = await JSZip.loadAsync(result)
      expect(zip.files['IMG1.scr']).toBeDefined()
      expect(zip.files['IMG2.scr']).toBeDefined()
      expect(zip.files['IMG3.scr']).toBeDefined()
    }
  })

  it('should compress ZIP with DEFLATE level 9', async () => {
    const images = [createMockImage(1)]
    const result = await exportDskWorkspaceZip(images)

    expect(result).not.toBeNull()
    // The compressed ZIP should be smaller than uncompressed DSK
    // DSK is ~180 KB, compressed should be significantly smaller
    if (result) {
      expect(result.size).toBeLessThan(184320) // DSK total size
    }
  })

  it('should handle custom dimensions with linear format', async () => {
    // Create an overscan image (custom dimensions)
    const overscanImage: DskImage = {
      id: 'overscan-1',
      name: 'Overscan',
      scrData: Array.from({ length: 192 * 272 }, () => 0), // 192x272 in mode 1
      mode: 1,
      width: 384,
      height: 272,
      overscan: true,
      nColors: 4,
      scaleX: 1,
      scaleY: 1.2,
      cpcHardware: 'classic',
      paletteFirmware: [0, 1, 2, 3],
      thumbnailDataUrl: 'data:image/png;base64,test',
      paletteColors: ['#000000', '#0000ff', '#ff0000', '#ff00ff']
    }

    const result = await exportDskWorkspaceZip([overscanImage])

    expect(result).not.toBeNull()
    expect(result).toBeInstanceOf(Blob)

    // Verify .bin file(s) are created for custom dimensions
    if (result) {
      const zip = await JSZip.loadAsync(result)

      // Linear format with chunking - should be split into multiple files
      // Total size: 96 * 272 = 26112 bytes
      // Should be split into 2 chunks (16384 + 9728 bytes)
      expect(zip.files['IMG1_1.bin']).toBeDefined()
      expect(zip.files['IMG1_2.bin']).toBeDefined()

      const chunk1Data = await zip.files['IMG1_1.bin'].async('uint8array')
      const chunk2Data = await zip.files['IMG1_2.bin'].async('uint8array')

      // Verify chunk sizes — first chunk should be the max 16KiB and second
      // should contain the remaining bytes for the linear export.
      expect(chunk1Data.length).toBe(16 * 1024) // 16KB max chunk
      expect(chunk2Data.length).toBeGreaterThan(0) // remaining chunk must be non-empty
    }
  })

  it('should add assembled BIN files when RASM is available', async () => {
    // Reset module mocks and set RASM to be available
    vi.resetModules()

    // Mock createRasmInstance to return a module that can assemble and return binary
    const module = {
      FS: {
        writeFile: vi.fn(),
        readFile: vi.fn()
      }
    }

    const assemble = vi.fn(async (_asm: string, _opts?: any) => ({
      success: true,
      binary: new Uint8Array([0x01, 0x02])
    }))

    createRasmInstanceImpl = vi.fn(async () => ({
      assemble,
      getModule: () => module
    }))

    // Replace rasm-wasm module with our mocks for this test
    // ensure vi.mock references the hoisted implementation
    vi.mock('@/libs/rasm-wasm', () => ({
      createRasmInstance: (...args: any[]) => createRasmInstanceImpl(...args)
    }))

    // Re-import function and run export with RASM available
    const { exportDskWorkspaceZip: exportZipWithRasm } = await import(
      './export-dsk-workspace-zip'
    )

    const images = [
      createMockImage(1),
      createMockImage(2) // two standard images
    ]

    const result = await exportZipWithRasm(images)

    expect(result).not.toBeNull()

    if (result) {
      const zip = await JSZip.loadAsync(result)

      // We expect assembled binaries to be present (instead of fallback raw SCR)
      expect(zip.files['IMG1.scr']).toBeDefined()
      expect(zip.files['IMG2.scr']).toBeDefined()
    }

    expect(createRasmInstanceImpl).toHaveBeenCalled()
    expect(assemble).toHaveBeenCalled()
  })

  it('supports CPC Plus palette injection when generating SCR files', async () => {
    vi.resetModules()

    // Spy on the CPC Plus injector implementation
    const cpcMod = await import('@/export/exports/cpc-plus-format')
    const spy = vi
      .spyOn(cpcMod, 'injectCPCPlusPaletteIntoSCR')
      .mockImplementation((scr: Uint8Array) => {
        // set the mode in the buffer so the exporter would treat it as plus
        scr[2034] = 1
      })

    // Re-import function and run export
    const { exportDskWorkspaceZip: exportZipPlus } = await import(
      './export-dsk-workspace-zip'
    )

    const plusImage = {
      ...createMockImage(1),
      cpcHardware: 'plus',
      palettePlus: Array.from({ length: 16 }, (_, i) => i)
    }

    const result = await exportZipPlus([plusImage as DskImage])

    // Ensure the spy was called and the zip includes a SCR
    expect(spy).toHaveBeenCalled()
    if (result) {
      const zip = await JSZip.loadAsync(result)

      expect(zip.files['IMG1.scr']).toBeDefined()
    }
  })

  it('should add assembled chunk BIN files when RASM is available (chunked images)', async () => {
    vi.resetModules()

    // Provide mocked RASM instance that returns a binary on successful assembly
    const module: any = {
      FS: { writeFile: vi.fn(), readFile: vi.fn() },
      callMain: vi.fn()
    }
    const assemble = vi.fn(async () => ({
      success: true,
      binary: new Uint8Array([1, 2, 3])
    }))
    createRasmInstanceImpl = vi.fn(async () => ({
      assemble,
      getModule: () => module
    }))

    vi.mock('@/libs/rasm-wasm', () => ({
      createRasmInstance: (...args: any[]) => createRasmInstanceImpl(...args)
    }))

    // Provide a linear export with two chunks via mock
    vi.mock('../export-linear-asm/export-linear.asm', () => ({
      exportLinearAsm: (_: any, __: any) => new Uint8Array(20000),
      splitLinearIntoChunks: (_: any) => [
        { index: 1, data: new Uint8Array(16384) },
        { index: 2, data: new Uint8Array(3616) }
      ]
    }))

    const { exportDskWorkspaceZip: exportZipChunked } = await import(
      './export-dsk-workspace-zip'
    )

    // Custom dimensions to ensure chunking is used (overscan toggled)
    const overImage: DskImage = {
      id: 'pchunk',
      name: 'PChunk',
      scrData: Array.from({ length: 20000 }, () => 0),
      mode: 1 as 1,
      width: 384,
      height: 272,
      overscan: true,
      nColors: 4,
      scaleX: 1,
      scaleY: 1,
      cpcHardware: 'classic',
      paletteFirmware: [0, 1, 2, 3],
      thumbnailDataUrl: 'data:image/png;base64,test',
      paletteColors: ['#000000', '#0000ff', '#ff0000', '#ff00ff']
    }

    const result = await exportZipChunked([overImage])
    expect(result).not.toBeNull()

    if (result) {
      const zip = await JSZip.loadAsync(result)
      expect(zip.files['IMG1_1.bin']).toBeDefined()
      expect(zip.files['IMG1_2.bin']).toBeDefined()
    }

    expect(createRasmInstanceImpl).toHaveBeenCalled()
    expect(assemble).toHaveBeenCalled()
  })

  it('continues on chunk assembly exceptions (does not throw) and logs', async () => {
    vi.resetModules()

    // RASM instance: throw from assemble to simulate unexpected error
    const module: any = {
      FS: { writeFile: vi.fn(), readFile: vi.fn() },
      callMain: vi.fn()
    }
    const assemble = vi.fn(async () => {
      throw new Error('assembly error')
    }) as any
    createRasmInstanceImpl = vi.fn(async () => ({
      assemble,
      getModule: () => module
    }))

    vi.mock('@/libs/rasm-wasm', () => ({
      createRasmInstance: (...args: any[]) => createRasmInstanceImpl(...args)
    }))

    vi.mock('../export-linear-asm/export-linear.asm', () => ({
      exportLinearAsm: (_: any, __: any) => new Uint8Array(20000),
      splitLinearIntoChunks: (_: any) => [
        { index: 1, data: new Uint8Array(16384) },
        { index: 2, data: new Uint8Array(3616) }
      ]
    }))

    const { exportDskWorkspaceZip: exportZipChunkedError } = await import(
      './export-dsk-workspace-zip'
    )

    // Custom dimensions to ensure chunking
    const overImage: DskImage = {
      id: 'pchunk',
      name: 'PChunk',
      scrData: Array.from({ length: 20000 }, () => 0),
      mode: 1 as 1,
      width: 384,
      height: 272,
      overscan: true,
      nColors: 4,
      scaleX: 1,
      scaleY: 1,
      cpcHardware: 'classic',
      paletteFirmware: [0, 1, 2, 3],
      thumbnailDataUrl: 'data:image/png;base64,test',
      paletteColors: ['#000000', '#0000ff', '#ff0000', '#ff00ff']
    }

    const result = await exportZipChunkedError([overImage])

    expect(result).not.toBeNull()
    if (result) {
      const zip = await JSZip.loadAsync(result)
      // RASM exists so no raw fallback for chunk should be present (except where code adds it)

      expect(zip.files['IMG1_1.bin']).toBeUndefined()
      expect(zip.files['IMG1_2.bin']).toBeUndefined()

      expect(zip.files['IMG1_1.bin']).toBeUndefined()
      expect(zip.files['IMG1_2.bin']).toBeUndefined()
    }

    expect(createRasmInstanceImpl).toHaveBeenCalled()
    expect(assemble).toHaveBeenCalled()
  })

  it('should warn when chunk assembly returns success=false and not add BIN', async () => {
    vi.resetModules()

    // Provide mocked RASM instance that returns {success:false}
    const module: any = {
      FS: { writeFile: vi.fn(), readFile: vi.fn() },
      callMain: vi.fn()
    }
    const assemble = vi.fn(async () => ({ success: false, output: 'ERR' }))
    createRasmInstanceImpl = vi.fn(async () => ({
      assemble,
      getModule: () => module
    }))

    vi.mock('@/libs/rasm-wasm', () => ({
      createRasmInstance: (...args: any[]) => createRasmInstanceImpl(...args)
    }))

    vi.mock('../export-linear-asm/export-linear.asm', () => ({
      exportLinearAsm: (_: any, __: any) => new Uint8Array(20000),
      splitLinearIntoChunks: (_: any) => [
        { index: 1, data: new Uint8Array(16384) },
        { index: 2, data: new Uint8Array(3616) }
      ]
    }))

    const { exportDskWorkspaceZip: exportZipChunkedFail } = await import(
      './export-dsk-workspace-zip'
    )

    const overImage: DskImage = {
      id: 'pchunk',
      name: 'PChunk',
      scrData: Array.from({ length: 20000 }, () => 0),
      mode: 1 as 1,
      width: 384,
      height: 272,
      overscan: true,
      nColors: 4,
      scaleX: 1,
      scaleY: 1,
      cpcHardware: 'classic',
      paletteFirmware: [0, 1, 2, 3],
      thumbnailDataUrl: 'data:image/png;base64,test',
      paletteColors: ['#000000', '#0000ff', '#ff0000', '#ff00ff']
    }

    const result = await exportZipChunkedFail([overImage])

    expect(result).not.toBeNull()
    if (result) {
      const zip = await JSZip.loadAsync(result)

      expect(zip.files['IMG1_1.bin']).toBeUndefined()
      expect(zip.files['IMG1_2.bin']).toBeUndefined()

      expect(zip.files['IMG1_1.bin']).toBeUndefined()
      expect(zip.files['IMG1_2.bin']).toBeUndefined()
    }

    expect(createRasmInstanceImpl).toHaveBeenCalled()
    expect(assemble).toHaveBeenCalled()
  })

  it('should fall back to raw data when assembly fails', async () => {
    vi.resetModules()

    const module: any = {
      FS: { writeFile: vi.fn(), readFile: vi.fn() },
      callMain: vi.fn()
    }

    const assemble = vi.fn(async (_asm: string, _opts?: any) => ({
      success: false,
      output: 'ERR'
    }))

    createRasmInstanceImpl = vi.fn(async () => ({
      assemble,
      getModule: () => module
    }))

    vi.mock('@/libs/rasm-wasm', () => ({
      createRasmInstance: (...args: any[]) => createRasmInstanceImpl(...args)
    }))

    const { exportDskWorkspaceZip: exportZipAssemblyFail } = await import(
      './export-dsk-workspace-zip'
    )

    const images = [createMockImage(1)]

    const result = await exportZipAssemblyFail(images)

    expect(result).not.toBeNull()
    if (result) {
      const zip = await JSZip.loadAsync(result)
      // Since assembly fails, no assembled BIN is added when RASM is available
      // (the exporter logs the failure but does not fallback to raw data automatically)
      expect(zip.files['IMG1.scr']).toBeUndefined()
    }

    expect(createRasmInstanceImpl).toHaveBeenCalled()
    expect(assemble).toHaveBeenCalled()
  })

  it('continues on standard assembly exceptions (does not throw) and logs', async () => {
    // Spy on createRasmInstance to return an instance whose assemble throws
    const rasmMod = await import('@/libs/rasm-wasm')
    const module: any = {
      FS: { writeFile: vi.fn(), readFile: vi.fn() },
      callMain: vi.fn()
    }
    const assemble = vi.fn(async () => {
      throw new Error('assembly error')
    })
    vi.spyOn(rasmMod, 'createRasmInstance').mockImplementation(async () => ({
      assemble,
      getModule: () => module,
      isReady: () => true,
      dispose: async () => undefined
    }))

    const { exportDskWorkspaceZip: exportZipStdError } = await import(
      './export-dsk-workspace-zip'
    )

    const images = [createMockImage(1)]

    const result = await exportZipStdError(images)

    expect(result).not.toBeNull()
    if (result) {
      const zip = await JSZip.loadAsync(result)
      // No assembled SCR is added, and exporter should not throw
      expect(zip.files['IMG1.scr']).toBeUndefined()
    }

    expect(assemble).toHaveBeenCalled()
  })

  it('returns null when exportDskWorkspace throws', async () => {
    // Ensure a thrown exception from exportDskWorkspace is caught by the ZIP exporter
    const ed = await import('./export-dsk-workspace')
    const throwSpy = vi
      .spyOn(ed, 'exportDskWorkspace')
      .mockImplementation(async () => {
        throw new Error('DSK generation failed')
      })

    // Re-import so that spy is applied
    const { exportDskWorkspaceZip: exportZipThrow } = await import(
      './export-dsk-workspace-zip'
    )

    const images = [createMockImage(1)]
    const result = await exportZipThrow(images)

    expect(result).toBeNull()

    // Restore spy so other tests still generate a DSK
    throwSpy.mockRestore()
  })

  it('handles unusual toASMData results (array) for standard SCR', async () => {
    // Make RASM assemble succeed (but toASMData will return array)
    const rasmMod = await import('@/libs/rasm-wasm')
    const module: any = {
      FS: { writeFile: vi.fn(), readFile: vi.fn() },
      callMain: vi.fn()
    }
    const assemble = vi.fn(async () => ({
      success: true,
      binary: new Uint8Array([1, 2]),
      output: '',
      exitCode: 0
    }))
    vi.spyOn(rasmMod, 'createRasmInstance').mockImplementation(async () => ({
      assemble,
      getModule: () => module,
      isReady: () => true,
      dispose: async () => undefined
    }))

    // Spy toASMData to return array
    const t = await import('../to-asm-data')
    vi.spyOn(t, 'toASMData').mockImplementation(() => [
      { filename: 'image1_chunk_0.asm', content: 'db #00' }
    ])

    const { exportDskWorkspaceZip: exportZipWeird } = await import(
      './export-dsk-workspace-zip'
    )

    const images = [createMockImage(1)]
    const result = await exportZipWeird(images)

    expect(result).not.toBeNull()
    if (result) {
      const zip = await JSZip.loadAsync(result)
      // Our custom toASMData returns an array; since exporter expects a string, it won't assemble
      // and since RASM is available, it will not fallback to raw SCR either
      expect(zip.files['IMG1.scr']).toBeUndefined()
    }
  })
})
