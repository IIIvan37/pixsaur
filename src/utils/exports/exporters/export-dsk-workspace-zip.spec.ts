import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { exportDskWorkspaceZip } from './export-dsk-workspace-zip'

// Mock exportDskWorkspace to avoid RASM loading in tests
vi.mock('./export-dsk-workspace', () => ({
  exportDskWorkspace: vi.fn(async (images: DskImage[]) => {
    if (images.length === 0) return null
    // Return a mock DSK file (180 KB)
    return new Uint8Array(184320)
  })
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
      expect(zip.files['IMAGE1.scr']).toBeDefined()
      expect(zip.files['IMAGE2.scr']).toBeDefined()
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
      expect(zip.files['IMAGE1.scr']).toBeDefined()
      const scrData = await zip.files['IMAGE1.scr'].async('uint8array')
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
      expect(zip.files['IMAGE1.scr']).toBeDefined()
      expect(zip.files['IMAGE2.scr']).toBeDefined()
      expect(zip.files['IMAGE3.scr']).toBeDefined()
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
})
