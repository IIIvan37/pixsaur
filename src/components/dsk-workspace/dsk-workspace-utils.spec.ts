import { describe, expect, it } from 'vitest'
import {
  calculateDskRemainingSpace,
  calculateScrSize,
  canAddImageToDsk,
  DSK_AVAILABLE_SIZE,
  DSK_CATALOG_SIZE,
  DSK_LOADER_SIZE,
  DSK_TOTAL_SIZE,
  formatDskSpace,
  formatImageSize,
  formatScrSize,
  getModeLabel
} from './dsk-workspace-utils'

describe('DSK Workspace Utils', () => {
  describe('DSK constants', () => {
    it('should have correct DSK total size', () => {
      expect(DSK_TOTAL_SIZE).toBe(184320) // 180 KB
    })

    it('should have correct catalog size', () => {
      expect(DSK_CATALOG_SIZE).toBe(2048) // 2 KB
    })

    it('should have correct loader size', () => {
      expect(DSK_LOADER_SIZE).toBe(1024) // 1 KB
    })

    it('should have correct available size', () => {
      expect(DSK_AVAILABLE_SIZE).toBe(181248) // 177 KB
      expect(DSK_AVAILABLE_SIZE).toBe(
        DSK_TOTAL_SIZE - DSK_CATALOG_SIZE - DSK_LOADER_SIZE
      )
    })
  })

  describe('calculateScrSize', () => {
    it('should always return 16384 bytes for SCR format', () => {
      // CPC SCR format is always 16KB (16384 bytes)
      const result = calculateScrSize()
      expect(result).toBe(16384)
    })
  })

  describe('calculateDskRemainingSpace', () => {
    it('should return full available DSK size when empty', () => {
      const result = calculateDskRemainingSpace([])
      expect(result).toBe(DSK_AVAILABLE_SIZE) // 181248 bytes (177 KB)
      expect(result).toBe(181248)
    })

    it('should calculate remaining space with 1 image', () => {
      const images = [{ scrData: new Uint8Array(16384) }]
      const fileSize = 16384 + 128 // SCR + AMSDOS header = 16512
      const result = calculateDskRemainingSpace(images)
      expect(result).toBe(DSK_AVAILABLE_SIZE - fileSize)
      expect(result).toBe(181248 - 16512)
      expect(result).toBe(164736)
    })

    it('should calculate remaining space with multiple images', () => {
      const images = [
        { scrData: new Uint8Array(16384) },
        { scrData: new Uint8Array(16384) },
        { scrData: new Uint8Array(16384) }
      ]
      const totalFiles = 3
      const fileSize = 16384 + 128 // 16512 per file
      const totalUsed = totalFiles * fileSize // 49536
      const result = calculateDskRemainingSpace(images)
      expect(result).toBe(DSK_AVAILABLE_SIZE - totalUsed)
      expect(result).toBe(181248 - 49536)
      expect(result).toBe(131712)
    })

    it('should handle number array scrData type', () => {
      const images = [{ scrData: new Array(16384).fill(0) }]
      const result = calculateDskRemainingSpace(images)
      expect(result).toBe(181248 - 16512)
    })

    it('should calculate max number of images on DSK (approximately 10)', () => {
      // Each file: 16384 + 128 = 16512 bytes
      // Available size: 181248 bytes (177 KB)
      // Max files: floor(181248 / 16512) = 10
      const maxFiles = Math.floor(DSK_AVAILABLE_SIZE / (16384 + 128))
      expect(maxFiles).toBe(10)

      const images = new Array(10).fill({ scrData: new Uint8Array(16384) })
      const remaining = calculateDskRemainingSpace(images)
      expect(remaining).toBeGreaterThanOrEqual(0)
      expect(remaining).toBeLessThan(16512)
    })
  })

  describe('canAddImageToDsk', () => {
    it('should return true when DSK is empty', () => {
      const result = canAddImageToDsk([])
      expect(result).toBe(true)
    })

    it('should return true when there is enough space', () => {
      const images = [
        { scrData: new Uint8Array(16384) },
        { scrData: new Uint8Array(16384) }
      ]
      const result = canAddImageToDsk(images)
      expect(result).toBe(true)
    })

    it('should return false when DSK is full', () => {
      // Max 10 images, so 10th image should still fit, but 11th should not
      const images = new Array(10).fill({ scrData: new Uint8Array(16384) })
      const result = canAddImageToDsk(images)
      expect(result).toBe(false)
    })

    it('should return true for 9 images (can add 10th)', () => {
      const images = new Array(9).fill({ scrData: new Uint8Array(16384) })
      const result = canAddImageToDsk(images)
      expect(result).toBe(true)
    })

    it('should handle number array scrData type', () => {
      const images = [{ scrData: new Array(16384).fill(0) }]
      const result = canAddImageToDsk(images)
      expect(result).toBe(true)
    })
  })

  describe('formatDskSpace', () => {
    it('should format full available DSK size', () => {
      const result = formatDskSpace(DSK_AVAILABLE_SIZE)
      expect(result).toBe('177 Ko')
    })

    it('should format remaining space after 1 file', () => {
      const remaining = 181248 - 16512
      const result = formatDskSpace(remaining)
      expect(result).toBe('160 Ko')
    })

    it('should format zero space', () => {
      const result = formatDskSpace(0)
      expect(result).toBe('0 Ko')
    })

    it('should floor the KB value', () => {
      // 1536 bytes = 1.5 KB → should display as 1 Ko
      const result = formatDskSpace(1536)
      expect(result).toBe('1 Ko')
    })
  })

  describe('formatScrSize', () => {
    it('should format standard SCR size (16384 bytes) as "17 Ko" with AMSDOS header', () => {
      // 16384 + 128 = 16512 bytes → rounds up to 17 Ko
      const result = formatScrSize(16384)
      expect(result).toBe('17 Ko')
    })

    it('should format smaller sizes correctly with header', () => {
      // 8192 + 128 = 8320 bytes → rounds up to 9 Ko
      const result = formatScrSize(8192)
      expect(result).toBe('9 Ko')
    })

    it('should round up correctly', () => {
      // 15000 + 128 = 15128 bytes → rounds up to 15 Ko
      const result = formatScrSize(15000)
      expect(result).toBe('15 Ko')
    })

    it('should handle zero bytes with header', () => {
      // 0 + 128 = 128 bytes → rounds up to 1 Ko
      const result = formatScrSize(0)
      expect(result).toBe('1 Ko')
    })

    it('should handle 1024 bytes with header', () => {
      // 1024 + 128 = 1152 bytes → rounds up to 2 Ko
      const result = formatScrSize(1024)
      expect(result).toBe('2 Ko')
    })

    it('should round up at exact KB boundary', () => {
      // 896 + 128 = 1024 bytes → exactly 1 Ko
      const result = formatScrSize(896)
      expect(result).toBe('1 Ko')
    })

    describe('CPC Screen Modes - Size Calculation', () => {
      it('should calculate Mode 0 SCR size (160×200 = 16384 bytes + 128 header)', () => {
        // Mode 0: 2 pixels per byte
        // 160 pixels width ÷ 2 = 80 bytes per line
        // 200 lines × 80 bytes = 16000 bytes visible
        // Total SCR = 16384 bytes (16KB with border)
        // + 128 bytes AMSDOS header = 16512 bytes → 17 Ko
        const width = 160
        const height = 200
        const pixelsPerByte = 2
        const bytesPerLine = width / pixelsPerByte
        const visibleBytes = bytesPerLine * height
        const totalScrBytes = 16384

        expect(bytesPerLine).toBe(80)
        expect(visibleBytes).toBe(16000)
        expect(totalScrBytes).toBe(16384)
        expect(formatScrSize(totalScrBytes)).toBe('17 Ko')
      })

      it('should calculate Mode 1 SCR size (320×200 = 16384 bytes + 128 header)', () => {
        // Mode 1: 4 pixels per byte
        // 320 pixels width ÷ 4 = 80 bytes per line
        // 200 lines × 80 bytes = 16000 bytes visible
        // Total SCR = 16384 bytes (16KB with border)
        // + 128 bytes AMSDOS header = 16512 bytes → 17 Ko
        const width = 320
        const height = 200
        const pixelsPerByte = 4
        const bytesPerLine = width / pixelsPerByte
        const visibleBytes = bytesPerLine * height
        const totalScrBytes = 16384

        expect(bytesPerLine).toBe(80)
        expect(visibleBytes).toBe(16000)
        expect(totalScrBytes).toBe(16384)
        expect(formatScrSize(totalScrBytes)).toBe('17 Ko')
      })

      it('should calculate Mode 2 SCR size (640×200 = 16384 bytes + 128 header)', () => {
        // Mode 2: 8 pixels per byte
        // 640 pixels width ÷ 8 = 80 bytes per line
        // 200 lines × 80 bytes = 16000 bytes visible
        // Total SCR = 16384 bytes (16KB with border)
        // + 128 bytes AMSDOS header = 16512 bytes → 17 Ko
        const width = 640
        const height = 200
        const pixelsPerByte = 8
        const bytesPerLine = width / pixelsPerByte
        const visibleBytes = bytesPerLine * height
        const totalScrBytes = 16384

        expect(bytesPerLine).toBe(80)
        expect(visibleBytes).toBe(16000)
        expect(totalScrBytes).toBe(16384)
        expect(formatScrSize(totalScrBytes)).toBe('17 Ko')
      })

      it('should verify that all CPC modes use exactly 16KB + header', () => {
        // CPC screen memory: 80 bytes × 200 lines = 16000 bytes visible
        // + 384 bytes border/unused = 16384 bytes total (16KB)
        // + 128 bytes AMSDOS header = 16512 bytes → 17 Ko
        const visibleBytes = 80 * 200 // 16000
        const totalBytes = 16384 // 16KB
        const borderBytes = totalBytes - visibleBytes // 384

        expect(visibleBytes).toBe(16000)
        expect(borderBytes).toBe(384)
        expect(totalBytes).toBe(16384)
        expect(formatScrSize(totalBytes)).toBe('17 Ko')
      })

      it('should handle custom dimensions within 64KB limit with header', () => {
        // Maximum custom size: 64KB = 65536 bytes
        // 65536 + 128 = 65664 bytes → 65 Ko
        const maxCustomSize = 65536
        expect(formatScrSize(maxCustomSize)).toBe('65 Ko')

        // 400×200 in Mode 1: 100 bytes × 200 lines = 20000 bytes
        // 20000 + 128 = 20128 bytes → 20 Ko
        const customMode1 = 20000
        expect(formatScrSize(customMode1)).toBe('20 Ko')

        // 640×400 in Mode 2: 80 bytes × 400 lines = 32000 bytes
        // 32000 + 128 = 32128 bytes → 32 Ko
        const customMode2 = 32000
        expect(formatScrSize(customMode2)).toBe('32 Ko')
      })
    })
  })

  describe('formatImageSize', () => {
    it('should format standard CPC screen resolution', () => {
      const result = formatImageSize(320, 200)
      expect(result).toBe('320×200')
    })

    it('should format Mode 2 resolution', () => {
      const result = formatImageSize(640, 200)
      expect(result).toBe('640×200')
    })

    it('should format Mode 0 resolution', () => {
      const result = formatImageSize(160, 200)
      expect(result).toBe('160×200')
    })

    it('should handle arbitrary dimensions', () => {
      const result = formatImageSize(800, 600)
      expect(result).toBe('800×600')
    })
  })

  describe('getModeLabel', () => {
    it('should return "Mode 0" for mode 0', () => {
      expect(getModeLabel(0)).toBe('Mode 0')
    })

    it('should return "Mode 1" for mode 1', () => {
      expect(getModeLabel(1)).toBe('Mode 1')
    })

    it('should return "Mode 2" for mode 2', () => {
      expect(getModeLabel(2)).toBe('Mode 2')
    })

    it('should return generic label for unknown modes', () => {
      expect(getModeLabel(3)).toBe('Mode 3')
      expect(getModeLabel(99)).toBe('Mode 99')
    })
  })
})
