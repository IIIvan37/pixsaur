import { describe, expect, it } from 'vitest'
import {
  AMSDOS_HEADER_SIZE,
  BYTES_PER_KB,
  calculateChunkCount,
  calculateDskRemainingSpace,
  calculateImageDskSize,
  calculateLinearSize,
  calculateScrSize,
  canAddImageToDsk,
  DSK_AVAILABLE_SIZE,
  DSK_CATALOG_SIZE,
  DSK_LOADER_SIZE,
  DSK_TEMPLATE_BASIC_SIZE,
  DSK_TOTAL_SIZE,
  formatDskSpace,
  formatFileSize,
  formatImageSize,
  formatScrSize,
  generateDskFilenames,
  getImageFormatInfo,
  getModeLabel,
  getPixelsPerByte,
  MAX_CHUNK_SIZE
} from './dsk-workspace-utils'

describe('DSK Workspace Utils', () => {
  describe('DSK constants', () => {
    it('should have correct DSK total size', () => {
      expect(DSK_TOTAL_SIZE).toBe(184320) // 180 KB
    })

    it('should have correct catalog size', () => {
      expect(DSK_CATALOG_SIZE).toBe(2 * BYTES_PER_KB) // 2 KB
    })

    it('should have correct loader size', () => {
      expect(DSK_LOADER_SIZE).toBe(BYTES_PER_KB) // 1 KB
    })

    it('should have correct template BASIC file size', () => {
      expect(DSK_TEMPLATE_BASIC_SIZE).toBe(BYTES_PER_KB) // 1 KB
    })

    it('should have correct available size', () => {
      expect(DSK_AVAILABLE_SIZE).toBe(180224) // 176 KB
      expect(DSK_AVAILABLE_SIZE).toBe(
        DSK_TOTAL_SIZE -
          DSK_CATALOG_SIZE -
          DSK_LOADER_SIZE -
          DSK_TEMPLATE_BASIC_SIZE
      )
    })

    it('should have correct AMSDOS header size', () => {
      expect(AMSDOS_HEADER_SIZE).toBe(128)
    })

    it('should have correct bytes per KB', () => {
      expect(BYTES_PER_KB).toBe(1024)
    })

    it('should have correct max chunk size', () => {
      expect(MAX_CHUNK_SIZE).toBe(16 * BYTES_PER_KB) // 16 KB
      expect(MAX_CHUNK_SIZE).toBe(16384)
    })
  })

  describe('getPixelsPerByte', () => {
    it('should return 2 pixels per byte for Mode 0', () => {
      expect(getPixelsPerByte(0)).toBe(2)
    })

    it('should return 4 pixels per byte for Mode 1', () => {
      expect(getPixelsPerByte(1)).toBe(4)
    })

    it('should return 8 pixels per byte for Mode 2', () => {
      expect(getPixelsPerByte(2)).toBe(8)
    })

    it('should throw error for invalid mode', () => {
      expect(() => getPixelsPerByte(3)).toThrow('Invalid CPC mode: 3')
      expect(() => getPixelsPerByte(-1)).toThrow('Invalid CPC mode: -1')
      expect(() => getPixelsPerByte(99)).toThrow('Invalid CPC mode: 99')
    })
  })

  describe('getImageFormatInfo', () => {
    it('should return correct info for standard Mode 1 image', () => {
      const info = getImageFormatInfo(320, 200, 1, false)
      expect(info.isStandard).toBe(true)
      expect(info.linearSize).toBe(16000) // 80 bytes × 200 lines
      expect(info.chunkCount).toBe(1)
      expect(info.totalSize).toBe(16512) // 16384 + 128
    })

    it('should return correct info for custom dimensions', () => {
      const info = getImageFormatInfo(400, 300, 1, false)
      expect(info.isStandard).toBe(false)
      expect(info.linearSize).toBe(30000) // 100 bytes × 300 lines
      expect(info.chunkCount).toBe(2) // 30000 > 16384
      expect(info.totalSize).toBe(30256) // 30000 + 2×128
    })

    it('should return correct info for overscan image', () => {
      const info = getImageFormatInfo(320, 200, 1, true)
      expect(info.isStandard).toBe(false)
      expect(info.linearSize).toBe(16000)
      expect(info.chunkCount).toBe(1)
      expect(info.totalSize).toBe(16128) // 16000 + 128
    })

    it('should handle Mode 0 standard dimensions', () => {
      const info = getImageFormatInfo(160, 200, 0, false)
      expect(info.isStandard).toBe(true)
      expect(info.linearSize).toBe(16000) // 80 bytes × 200 lines
      expect(info.totalSize).toBe(16512)
    })

    it('should handle Mode 2 standard dimensions', () => {
      const info = getImageFormatInfo(640, 200, 2, false)
      expect(info.isStandard).toBe(true)
      expect(info.linearSize).toBe(16000) // 80 bytes × 200 lines
      expect(info.totalSize).toBe(16512)
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
      expect(result).toBe(DSK_AVAILABLE_SIZE) // 180224 bytes (176 KB)
      expect(result).toBe(180224)
    })

    it('should calculate remaining space with 1 image', () => {
      const images = [
        {
          scrData: new Uint8Array(16384),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        }
      ]
      const fileSize = 16384 + AMSDOS_HEADER_SIZE // SCR + AMSDOS header = 16512
      const result = calculateDskRemainingSpace(images)
      expect(result).toBe(DSK_AVAILABLE_SIZE - fileSize)
      expect(result).toBe(180224 - 16512)
      expect(result).toBe(163712)
    })

    it('should calculate remaining space with multiple images', () => {
      const images = [
        {
          scrData: new Uint8Array(16384),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        },
        {
          scrData: new Uint8Array(16384),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        },
        {
          scrData: new Uint8Array(16384),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        }
      ]
      const totalFiles = 3
      const fileSize = 16384 + 128 // 16512 per file
      const totalUsed = totalFiles * fileSize // 49536
      const result = calculateDskRemainingSpace(images)
      expect(result).toBe(DSK_AVAILABLE_SIZE - totalUsed)
      expect(result).toBe(180224 - 49536)
      expect(result).toBe(130688)
    })

    it('should handle number array scrData type', () => {
      const images = [
        {
          scrData: new Array(16384).fill(0),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        }
      ]
      const result = calculateDskRemainingSpace(images)
      expect(result).toBe(180224 - 16512)
    })

    it('should calculate max number of images on DSK (approximately 10)', () => {
      // Each file: 16384 + 128 = 16512 bytes
      // Available size: 180224 bytes (176 KB)
      // Max files: floor(180224 / 16512) = 10
      const maxFiles = Math.floor(DSK_AVAILABLE_SIZE / (16384 + 128))
      expect(maxFiles).toBe(10)

      const images = new Array(10).fill({
        scrData: new Uint8Array(16384),
        width: 320,
        height: 200,
        mode: 1,
        overscan: false
      })
      const remaining = calculateDskRemainingSpace(images)
      expect(remaining).toBeGreaterThanOrEqual(0)
      expect(remaining).toBeLessThan(16512)
    })
  })

  describe('canAddImageToDsk', () => {
    it('should return true when DSK is empty', () => {
      const result = canAddImageToDsk([], {
        width: 320,
        height: 200,
        mode: 1,
        overscan: false
      })
      expect(result).toBe(true)
    })

    it('should return true when DSK is empty and no newImage specified (assumes standard SCR)', () => {
      const result = canAddImageToDsk([])
      expect(result).toBe(true)
    })

    it('should return true when there is enough space', () => {
      const images = [
        {
          scrData: new Uint8Array(16384),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        },
        {
          scrData: new Uint8Array(16384),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        },
        {
          scrData: new Uint8Array(16384),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        }
      ]
      const result = canAddImageToDsk(images, {
        width: 320,
        height: 200,
        mode: 1,
        overscan: false
      })
      expect(result).toBe(true)
    })

    it('should return true when there is enough space and no newImage specified', () => {
      const images = [
        {
          scrData: new Uint8Array(16384),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        },
        {
          scrData: new Uint8Array(16384),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        }
      ]
      const result = canAddImageToDsk(images)
      expect(result).toBe(true)
    })

    it('should return false when DSK is full', () => {
      // Max 10 images, so 10th image should still fit, but 11th should not
      const images = new Array(10).fill({
        scrData: new Uint8Array(16384),
        width: 320,
        height: 200,
        mode: 1,
        overscan: false
      })
      const result = canAddImageToDsk(images, {
        width: 320,
        height: 200,
        mode: 1,
        overscan: false
      })
      expect(result).toBe(false)
    })

    it('should return false when DSK is full and no newImage specified', () => {
      const images = new Array(10).fill({
        scrData: new Uint8Array(16384),
        width: 320,
        height: 200,
        mode: 1,
        overscan: false
      })
      const result = canAddImageToDsk(images)
      expect(result).toBe(false)
    })

    it('should return true for 9 images (can add 10th)', () => {
      const images = new Array(9).fill({
        scrData: new Uint8Array(16384),
        width: 320,
        height: 200,
        mode: 1,
        overscan: false
      })
      const result = canAddImageToDsk(images, {
        width: 320,
        height: 200,
        mode: 1,
        overscan: false
      })
      expect(result).toBe(true)
    })

    it('should handle number array scrData type', () => {
      const images = [
        {
          scrData: new Array(16384).fill(0),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        }
      ]
      const result = canAddImageToDsk(images, {
        width: 320,
        height: 200,
        mode: 1,
        overscan: false
      })
      expect(result).toBe(true)
    })
  })

  describe('formatDskSpace', () => {
    it('should format full available DSK size', () => {
      const result = formatDskSpace(DSK_AVAILABLE_SIZE)
      expect(result).toBe('176 Ko')
    })

    it('should format remaining space after 1 file', () => {
      const remaining = 180224 - 16512
      const result = formatDskSpace(remaining)
      expect(result).toBe('159 Ko')
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

  describe('calculateLinearSize', () => {
    it('should calculate linear size for Mode 0 (2 pixels per byte)', () => {
      // Mode 0: 2 pixels per byte
      // 320 width ÷ 2 = 160 bytes per line
      // 160 × 200 = 32000 bytes
      const result = calculateLinearSize(320, 200, 0)
      expect(result).toBe(32000)
    })

    it('should calculate linear size for Mode 1 (4 pixels per byte)', () => {
      // Mode 1: 4 pixels per byte
      // 400 width ÷ 4 = 100 bytes per line
      // 100 × 300 = 30000 bytes
      const result = calculateLinearSize(400, 300, 1)
      expect(result).toBe(30000)
    })

    it('should calculate linear size for Mode 2 (8 pixels per byte)', () => {
      // Mode 2: 8 pixels per byte
      // 800 width ÷ 8 = 100 bytes per line
      // 100 × 400 = 40000 bytes
      const result = calculateLinearSize(800, 400, 2)
      expect(result).toBe(40000)
    })

    it('should handle standard Mode 1 dimensions', () => {
      // Standard Mode 1: 320×200
      // 320 ÷ 4 = 80 bytes per line
      // 80 × 200 = 16000 bytes
      const result = calculateLinearSize(320, 200, 1)
      expect(result).toBe(16000)
    })
  })

  describe('calculateChunkCount', () => {
    it('should return 1 for data <= 16KB', () => {
      expect(calculateChunkCount(MAX_CHUNK_SIZE)).toBe(1)
      expect(calculateChunkCount(16000)).toBe(1)
      expect(calculateChunkCount(1024)).toBe(1)
    })

    it('should return 2 for data between 16KB and 32KB', () => {
      expect(calculateChunkCount(MAX_CHUNK_SIZE + 1)).toBe(2)
      expect(calculateChunkCount(20000)).toBe(2)
      expect(calculateChunkCount(2 * MAX_CHUNK_SIZE)).toBe(2)
    })

    it('should return 3 for data between 32KB and 48KB', () => {
      expect(calculateChunkCount(2 * MAX_CHUNK_SIZE + 1)).toBe(3)
      expect(calculateChunkCount(40000)).toBe(3)
      expect(calculateChunkCount(3 * MAX_CHUNK_SIZE)).toBe(3)
    })

    it('should handle exact multiples of 16KB', () => {
      expect(calculateChunkCount(MAX_CHUNK_SIZE)).toBe(1)
      expect(calculateChunkCount(2 * MAX_CHUNK_SIZE)).toBe(2)
      expect(calculateChunkCount(3 * MAX_CHUNK_SIZE)).toBe(3)
    })
  })

  describe('generateDskFilenames', () => {
    it('should return .SCR filename for standard Mode 0 image', () => {
      const filenames = generateDskFilenames(1, 160, 200, 0, false)
      expect(filenames).toEqual(['IMG1.SCR'])
    })

    it('should return .SCR filename for standard Mode 1 image', () => {
      const filenames = generateDskFilenames(2, 320, 200, 1, false)
      expect(filenames).toEqual(['IMG2.SCR'])
    })

    it('should return .SCR filename for standard Mode 2 image', () => {
      const filenames = generateDskFilenames(3, 640, 200, 2, false)
      expect(filenames).toEqual(['IMG3.SCR'])
    })

    it('should return .BIN filename for custom dimensions that fit in one chunk', () => {
      // 320×150 Mode 1: 80×150 = 12000 bytes (< 16KB, fits in 1 chunk)
      const filenames = generateDskFilenames(1, 320, 150, 1, false)
      expect(filenames).toEqual(['IMG1.BIN'])
    })

    it('should return multiple .BIN filenames for custom dimensions requiring multiple chunks', () => {
      // 320×300 Mode 1 = 80×300 = 24000 bytes (> 16KB, needs 2 chunks)
      const filenames = generateDskFilenames(5, 320, 300, 1, false)
      expect(filenames).toEqual(['IMG5_1.BIN', 'IMG5_2.BIN'])
    })

    it('should return .BIN for overscan image (not standard)', () => {
      const filenames = generateDskFilenames(1, 320, 200, 1, true)
      expect(filenames).toEqual(['IMG1.BIN'])
    })

    it('should handle large custom dimensions with many chunks', () => {
      // 800×400 Mode 2 = 100×400 = 40000 bytes (needs 3 chunks)
      const filenames = generateDskFilenames(10, 800, 400, 2, false)
      expect(filenames).toEqual(['IMG10_1.BIN', 'IMG10_2.BIN', 'IMG10_3.BIN'])
    })
  })

  describe('calculateImageDskSize', () => {
    it('should return 16512 bytes for standard Mode 1 image (16384 + 128)', () => {
      const size = calculateImageDskSize(320, 200, 1, false)
      expect(size).toBe(16384 + AMSDOS_HEADER_SIZE)
    })

    it('should return 16512 bytes for standard Mode 0 image', () => {
      const size = calculateImageDskSize(160, 200, 0, false)
      expect(size).toBe(16512)
    })

    it('should return 16512 bytes for standard Mode 2 image', () => {
      const size = calculateImageDskSize(640, 200, 2, false)
      expect(size).toBe(16512)
    })

    it('should calculate size for custom dimensions with single chunk', () => {
      // 400×150 Mode 1 = 100×150 = 15000 bytes + 128 header = 15128
      const size = calculateImageDskSize(400, 150, 1, false)
      expect(size).toBe(15000 + AMSDOS_HEADER_SIZE)
    })

    it('should calculate size for custom dimensions with multiple chunks', () => {
      // 320×300 Mode 1 = 80×300 = 24000 bytes
      // 2 chunks needed → 24000 + (2 × 128) = 24256
      const size = calculateImageDskSize(320, 300, 1, false)
      expect(size).toBe(24000 + 2 * AMSDOS_HEADER_SIZE)
    })

    it('should treat overscan as custom (not standard)', () => {
      // Overscan 320×200 Mode 1: linear = 80×200 = 16000 bytes
      // 1 chunk → 16000 + 128 = 16128 (different from standard 16512)
      const size = calculateImageDskSize(320, 200, 1, true)
      expect(size).toBe(16000 + AMSDOS_HEADER_SIZE)
    })
  })

  describe('formatFileSize', () => {
    it('should format file size without AMSDOS header', () => {
      // 16384 bytes = 16 KB → 16 Ko
      expect(formatFileSize(16384)).toBe('16 Ko')
    })

    it('should round up to next KB', () => {
      // 16385 bytes = 16.001 KB → rounds up to 17 Ko
      expect(formatFileSize(16385)).toBe('17 Ko')
    })

    it('should handle small sizes', () => {
      expect(formatFileSize(512)).toBe('1 Ko')
      expect(formatFileSize(BYTES_PER_KB)).toBe('1 Ko')
      expect(formatFileSize(BYTES_PER_KB + 1)).toBe('2 Ko')
    })

    it('should handle exact KB boundaries', () => {
      expect(formatFileSize(BYTES_PER_KB)).toBe('1 Ko')
      expect(formatFileSize(2 * BYTES_PER_KB)).toBe('2 Ko')
      expect(formatFileSize(16 * BYTES_PER_KB)).toBe('16 Ko')
    })
  })

  describe('Custom dimensions - Integration tests', () => {
    it('should handle custom dimension images in DSK remaining space calculation', () => {
      const images = [
        {
          scrData: new Uint8Array(24000),
          width: 320,
          height: 300,
          mode: 1,
          overscan: false
        }
      ]
      // 320×300 Mode 1 = 24000 bytes + 2 chunks × 128 = 24256 bytes
      const remaining = calculateDskRemainingSpace(images)
      expect(remaining).toBe(DSK_AVAILABLE_SIZE - 24256)
    })

    it('should allow adding custom dimension image if space available', () => {
      const images = [
        {
          scrData: new Uint8Array(16384),
          width: 320,
          height: 200,
          mode: 1,
          overscan: false
        }
      ]
      // Try to add a custom 400×200 image (20000 + 2×128 = 20256 bytes)
      const canAdd = canAddImageToDsk(images, {
        width: 400,
        height: 200,
        mode: 1,
        overscan: false
      })
      expect(canAdd).toBe(true)
    })

    it('should correctly calculate when custom image does not fit', () => {
      // Fill DSK with 10 standard images (close to full)
      const images = new Array(10).fill({
        scrData: new Uint8Array(16384),
        width: 320,
        height: 200,
        mode: 1,
        overscan: false
      })
      // Try to add a large custom image
      const canAdd = canAddImageToDsk(images, {
        width: 800,
        height: 400,
        mode: 2,
        overscan: false
      })
      expect(canAdd).toBe(false)
    })
  })
})
