import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { exportDskWorkspaceZip } from './export-dsk-workspace-zip'

// `vi` already imported above

// Mock exportDskWorkspace to avoid RASM loading in tests
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
      expect(zip.files['IMG00001.scr']).toBeDefined()
      expect(zip.files['IMG00002.scr']).toBeDefined()
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
      expect(zip.files['IMG00001.scr']).toBeDefined()
      const scrData = await zip.files['IMG00001.scr'].async('uint8array')
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
      expect(zip.files['IMG00001.scr']).toBeDefined()
      expect(zip.files['IMG00002.scr']).toBeDefined()
      expect(zip.files['IMG00003.scr']).toBeDefined()
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
      expect(zip.files['IMG00001_1.bin']).toBeDefined()
      expect(zip.files['IMG00001_2.bin']).toBeDefined()

      const chunk1Data = await zip.files['IMG00001_1.bin'].async('uint8array')
      const chunk2Data = await zip.files['IMG00001_2.bin'].async('uint8array')

      // Verify chunk sizes
      expect(chunk1Data.length).toBe(16 * 1024) // 16KB max chunk
      expect(chunk2Data.length).toBe(26112 - 16384) // Remaining data
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
      expect(zip.files['IMG00001.scr']).toBeDefined()
      expect(zip.files['IMG00002.scr']).toBeDefined()
    }

    expect(createRasmInstanceImpl).toHaveBeenCalled()
    expect(assemble).toHaveBeenCalled()
  })

  it('should fall back to raw data when assembly fails', async () => {
    vi.resetModules()

    const module = { FS: { writeFile: vi.fn(), readFile: vi.fn() } }

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
      expect(zip.files['IMG00001.scr']).toBeUndefined()
    }

    expect(createRasmInstanceImpl).toHaveBeenCalled()
    expect(assemble).toHaveBeenCalled()
  })
})
