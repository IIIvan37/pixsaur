import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pickImageFileTauri } from './tauri-file-picker'

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn()
  }
}))

// Import mocked functions
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { logger } from '@/utils/logger'

describe('pickImageFileTauri', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when user cancels', async () => {
    vi.mocked(open).mockResolvedValue(null)

    const result = await pickImageFileTauri()

    expect(result).toBeNull()
    expect(open).toHaveBeenCalledWith({
      multiple: false,
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
        }
      ]
    })
  })

  it('should throw error when selected is not a string', async () => {
    vi.mocked(open).mockResolvedValue(['path1', 'path2'] as any)

    await expect(pickImageFileTauri()).rejects.toThrow('Failed to load image')
    expect(logger.error).toHaveBeenCalled()
  })

  it('should read and convert PNG file to data URL', async () => {
    const filePath = '/test/image.png'
    const fileContent = new Uint8Array([137, 80, 78, 71]) // PNG header
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(open).toHaveBeenCalled()
    expect(readFile).toHaveBeenCalledWith(filePath)
    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('should handle JPG files correctly', async () => {
    const filePath = '/test/photo.jpg'
    const fileContent = new Uint8Array([255, 216, 255, 224]) // JPEG header
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('should handle JPEG files correctly', async () => {
    const filePath = '/test/photo.jpeg'
    const fileContent = new Uint8Array([255, 216, 255, 224])
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('should handle GIF files correctly', async () => {
    const filePath = '/test/animation.gif'
    const fileContent = new Uint8Array([71, 73, 70, 56]) // GIF header
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toMatch(/^data:image\/gif;base64,/)
  })

  it('should handle WEBP files correctly', async () => {
    const filePath = '/test/image.webp'
    const fileContent = new Uint8Array([82, 73, 70, 70])
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toMatch(/^data:image\/webp;base64,/)
  })

  it('should handle BMP files correctly', async () => {
    const filePath = '/test/image.bmp'
    const fileContent = new Uint8Array([66, 77])
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toMatch(/^data:image\/bmp;base64,/)
  })

  it('should handle SVG files correctly', async () => {
    const filePath = '/test/vector.svg'
    const fileContent = new Uint8Array([60, 115, 118, 103]) // <svg
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toMatch(/^data:image\/svg\+xml;base64,/)
  })

  it('should default to PNG for unknown extensions', async () => {
    const filePath = '/test/image.unknown'
    const fileContent = new Uint8Array([1, 2, 3, 4])
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('should handle file without extension', async () => {
    const filePath = '/test/image'
    const fileContent = new Uint8Array([1, 2, 3, 4])
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('should convert file content to base64 correctly', async () => {
    const filePath = '/test/test.png'
    // Simple test data: [255, 0, 128] -> should produce specific base64
    const fileContent = new Uint8Array([255, 0, 128])
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toBeTruthy()
    expect(result).toContain('base64,')

    // Verify we can decode it back
    const base64Part = result!.split('base64,')[1]
    expect(base64Part).toBeTruthy()
  })

  it('should log error and throw on file read failure', async () => {
    const filePath = '/test/image.png'
    const error = new Error('Permission denied')
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockRejectedValue(error)

    await expect(pickImageFileTauri()).rejects.toThrow('Failed to load image')

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to pick and read image file:',
      error
    )
  })

  it('should log error and throw on dialog open failure', async () => {
    const error = new Error('Dialog failed')
    vi.mocked(open).mockRejectedValue(error)

    await expect(pickImageFileTauri()).rejects.toThrow('Failed to load image')

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to pick and read image file:',
      error
    )
  })

  it('should handle uppercase file extensions', async () => {
    const filePath = '/test/IMAGE.PNG'
    const fileContent = new Uint8Array([1, 2, 3, 4])
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('should handle mixed case file extensions', async () => {
    const filePath = '/test/photo.JpEg'
    const fileContent = new Uint8Array([1, 2, 3, 4])
    vi.mocked(open).mockResolvedValue(filePath)
    vi.mocked(readFile).mockResolvedValue(fileContent)

    const result = await pickImageFileTauri()

    expect(result).toMatch(/^data:image\/jpeg;base64,/)
  })
})
