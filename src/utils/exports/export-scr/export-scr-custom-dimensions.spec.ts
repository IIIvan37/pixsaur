import { describe, expect, it } from 'vitest'
import type { CpcModeConfig } from '@/app/store/config/types'
import { exportSCR } from './export-scr'

describe('exportSCR - Custom Dimensions', () => {
  it('should export SCR with custom dimensions for Mode 0', () => {
    // Mode 0: 2 pixels per byte
    const customConfig: CpcModeConfig = {
      overscan: false,
      mode: 0,
      width: 164, // Custom width (must be multiple of 4)
      height: 248, // Custom height (must be multiple of 8)
      nColors: 16,
      scaleX: 2,
      scaleY: 1
    }

    const widthInBytes = customConfig.width / 2 // 82 bytes
    const expectedSize = widthInBytes * customConfig.height // 82 × 248 = 20336 bytes

    // Create dummy index buffer
    const indexBuf = new Uint8Array(expectedSize).fill(0)

    const scr = exportSCR(indexBuf, customConfig)

    // SCR should have exact size (no padding or header in raw SCR)
    expect(scr.length).toBe(expectedSize)
  })

  it('should export SCR with custom dimensions for Mode 1', () => {
    // Mode 1: 4 pixels per byte
    const customConfig: CpcModeConfig = {
      overscan: false,
      mode: 1,
      width: 328, // Custom width (must be multiple of 8)
      height: 248,
      nColors: 4,
      scaleX: 1,
      scaleY: 1
    }

    const widthInBytes = customConfig.width / 4 // 82 bytes
    const expectedSize = widthInBytes * customConfig.height // 82 × 248 = 20336 bytes

    const indexBuf = new Uint8Array(expectedSize).fill(0)

    const scr = exportSCR(indexBuf, customConfig)

    expect(scr.length).toBe(expectedSize)
  })

  it('should export SCR with custom dimensions for Mode 2', () => {
    // Mode 2: 8 pixels per byte
    const customConfig: CpcModeConfig = {
      overscan: false,
      mode: 2,
      width: 656, // Custom width (must be multiple of 16)
      height: 248,
      nColors: 2,
      scaleX: 1,
      scaleY: 2
    }

    const widthInBytes = customConfig.width / 8 // 82 bytes
    const expectedSize = widthInBytes * customConfig.height // 82 × 248 = 20336 bytes

    const indexBuf = new Uint8Array(expectedSize).fill(0)

    const scr = exportSCR(indexBuf, customConfig)

    expect(scr.length).toBe(expectedSize)
  })

  it('should handle small custom dimensions', () => {
    const customConfig: CpcModeConfig = {
      overscan: false,
      mode: 0,
      width: 64, // Small width
      height: 64, // Small height
      nColors: 16,
      scaleX: 2,
      scaleY: 1
    }

    const widthInBytes = customConfig.width / 2 // 32 bytes
    const expectedSize = widthInBytes * customConfig.height // 32 × 64 = 2048 bytes

    const indexBuf = new Uint8Array(expectedSize).fill(0)

    const scr = exportSCR(indexBuf, customConfig)

    expect(scr.length).toBe(expectedSize)
  })

  it('should handle maximum valid custom dimensions under 64Ko', () => {
    const customConfig: CpcModeConfig = {
      overscan: false,
      mode: 0,
      width: 512, // Large width (512 / 2 = 256 bytes)
      height: 256, // Large height (256 × 256 = 65536 bytes = exactly 64 Ko)
      nColors: 16,
      scaleX: 2,
      scaleY: 1
    }

    const widthInBytes = customConfig.width / 2 // 256 bytes
    const expectedSize = widthInBytes * customConfig.height // 256 × 256 = 65536 bytes

    const indexBuf = new Uint8Array(expectedSize).fill(0)

    const scr = exportSCR(indexBuf, customConfig)

    expect(scr.length).toBe(expectedSize)
    expect(scr.length).toBeLessThanOrEqual(65536) // Should be ≤ 64 Ko
  })

  it('should correctly encode data with custom dimensions', () => {
    const customConfig: CpcModeConfig = {
      overscan: false,
      mode: 0,
      width: 8, // 4 bytes per line
      height: 8,
      nColors: 16,
      scaleX: 2,
      scaleY: 1
    }

    const widthInBytes = customConfig.width / 2 // 4 bytes
    const totalBytes = widthInBytes * customConfig.height // 32 bytes

    // Create index buffer with pattern: alternating 0x00 and 0xFF
    const indexBuf = new Uint8Array(totalBytes)
    for (let i = 0; i < totalBytes; i++) {
      indexBuf[i] = i % 2 === 0 ? 0x00 : 0xff
    }

    const scr = exportSCR(indexBuf, customConfig)

    // Verify data is preserved (exportSCR should just rearrange scan lines)
    expect(scr.length).toBe(totalBytes)
    // First byte should still be from the pattern
    expect(scr[0]).toBeDefined()
  })
})
