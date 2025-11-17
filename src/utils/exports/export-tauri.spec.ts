import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveTauriFile, saveZipFileTauri } from '@/tauri'

// Mock Tauri plugins directly — tests are allowed to mock platform modules.
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn()
}))

describe('export-tauri', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('saveTauriFile', () => {
    it('should return false when user cancels the dialog', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(save).mockResolvedValue(null)

      const data = new Uint8Array([1, 2, 3])
      const result = await saveTauriFile(data, 'test.bin')

      expect(save).toHaveBeenCalledWith({
        defaultPath: 'test.bin',
        filters: [
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      })
      expect(result).toBe(false)
    })

    it('should save Uint8Array data and return true on success', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')

      vi.mocked(save).mockResolvedValue('/path/to/file.bin')
      vi.mocked(writeFile).mockResolvedValue()

      const data = new Uint8Array([1, 2, 3, 4, 5])
      const result = await saveTauriFile(data, 'test.bin')

      expect(save).toHaveBeenCalledWith({
        defaultPath: 'test.bin',
        filters: [
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      })
      expect(writeFile).toHaveBeenCalledWith('/path/to/file.bin', data)
      expect(result).toBe(true)
    })

    it('should convert Blob to Uint8Array before saving', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')

      vi.mocked(save).mockResolvedValue('/path/to/file.bin')
      vi.mocked(writeFile).mockResolvedValue()

      const blobData = new Blob([new Uint8Array([10, 20, 30])])
      const result = await saveTauriFile(blobData, 'test.bin')

      expect(save).toHaveBeenCalled()
      expect(writeFile).toHaveBeenCalledWith(
        '/path/to/file.bin',
        expect.any(Uint8Array)
      )

      const writtenData = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array
      expect(Array.from(writtenData)).toEqual([10, 20, 30])
      expect(result).toBe(true)
    })

    it('should use custom filters when provided', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')

      vi.mocked(save).mockResolvedValue('/path/to/file.scr')
      vi.mocked(writeFile).mockResolvedValue()

      const data = new Uint8Array([1, 2, 3])
      const filters = [
        {
          name: 'CPC Screen',
          extensions: ['scr']
        },
        {
          name: 'All Files',
          extensions: ['*']
        }
      ]

      const result = await saveTauriFile(data, 'image.scr', filters)

      expect(save).toHaveBeenCalledWith({
        defaultPath: 'image.scr',
        filters: filters
      })
      expect(result).toBe(true)
    })

    it('should throw error when writeFile fails', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')

      vi.mocked(save).mockResolvedValue('/path/to/file.bin')
      const writeError = new Error('Permission denied')
      vi.mocked(writeFile).mockRejectedValue(writeError)

      // Mock console.error to avoid test output pollution
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const data = new Uint8Array([1, 2, 3])

      await expect(saveTauriFile(data, 'test.bin')).rejects.toThrow(
        'Permission denied'
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Pixsaur]',
        '[Tauri Export] Failed to write file:',
        writeError
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle empty data', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')

      vi.mocked(save).mockResolvedValue('/path/to/empty.bin')
      vi.mocked(writeFile).mockResolvedValue()

      const data = new Uint8Array([])
      const result = await saveTauriFile(data, 'empty.bin')

      expect(writeFile).toHaveBeenCalledWith('/path/to/empty.bin', data)
      expect(result).toBe(true)
    })
  })

  describe('saveZipFileTauri', () => {
    it('should save ZIP file with correct filters', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')

      vi.mocked(save).mockResolvedValue('/path/to/archive.zip')
      vi.mocked(writeFile).mockResolvedValue()

      const zipBlob = new Blob([new Uint8Array([80, 75, 3, 4])]) // ZIP magic bytes
      const result = await saveZipFileTauri(zipBlob, 'archive.zip')

      expect(save).toHaveBeenCalledWith({
        defaultPath: 'archive.zip',
        filters: [
          {
            name: 'ZIP Archive',
            extensions: ['zip']
          },
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      })
      expect(result).toBe(true)
    })

    it('should return false when user cancels ZIP save dialog', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(save).mockResolvedValue(null)

      const zipBlob = new Blob([new Uint8Array([80, 75, 3, 4])])
      const result = await saveZipFileTauri(zipBlob, 'archive.zip')

      expect(result).toBe(false)
    })

    it('should convert ZIP blob to Uint8Array and save', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')

      vi.mocked(save).mockResolvedValue('/downloads/export.zip')
      vi.mocked(writeFile).mockResolvedValue()

      const zipData = new Uint8Array([80, 75, 3, 4, 10, 20, 30])
      const zipBlob = new Blob([zipData])
      const result = await saveZipFileTauri(zipBlob, 'export.zip')

      expect(writeFile).toHaveBeenCalledWith(
        '/downloads/export.zip',
        expect.any(Uint8Array)
      )

      const writtenData = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array
      expect(Array.from(writtenData)).toEqual([80, 75, 3, 4, 10, 20, 30])
      expect(result).toBe(true)
    })

    it('should throw error when ZIP write fails', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')

      vi.mocked(save).mockResolvedValue('/path/to/archive.zip')
      const writeError = new Error('Disk full')
      vi.mocked(writeFile).mockRejectedValue(writeError)

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const zipBlob = new Blob([new Uint8Array([80, 75, 3, 4])])

      await expect(saveZipFileTauri(zipBlob, 'archive.zip')).rejects.toThrow(
        'Disk full'
      )

      consoleErrorSpy.mockRestore()
    })
  })
})
