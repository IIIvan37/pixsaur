import { describe, expect, it } from 'vitest'
import type { CpcModeConfig } from '@/app/store/config/types'
import { computeCPCAddress, exportSCR } from './export-scr'

describe('exportSCR - Validation', () => {
  it('should reject custom dimensions for SCR export', () => {
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

    expect(() => exportSCR(indexBuf, customConfig)).toThrow(
      'SCR export only supports standard CPC screen dimensions'
    )
  })

  it('should reject custom dimensions for Mode 1', () => {
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

    expect(() => exportSCR(indexBuf, customConfig)).toThrow(
      'SCR export only supports standard CPC screen dimensions'
    )
  })

  it('should reject custom dimensions for Mode 2', () => {
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

    expect(() => exportSCR(indexBuf, customConfig)).toThrow(
      'SCR export only supports standard CPC screen dimensions'
    )
  })

  it('should reject small custom dimensions', () => {
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

    expect(() => exportSCR(indexBuf, customConfig)).toThrow(
      'SCR export only supports standard CPC screen dimensions'
    )
  })

  it('should reject maximum valid custom dimensions under 64Ko', () => {
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

    expect(() => exportSCR(indexBuf, customConfig)).toThrow(
      'SCR export only supports standard CPC screen dimensions'
    )
  })

  it('should accept standard Mode 0 dimensions', () => {
    const standardConfig: CpcModeConfig = {
      overscan: false,
      mode: 0,
      width: 160,
      height: 200,
      nColors: 16,
      scaleX: 2,
      scaleY: 1
    }

    const widthInBytes = standardConfig.width / 2 // 80 bytes
    const pixelDataBytes = widthInBytes * standardConfig.height // 80 × 200 = 16000 bytes

    const indexBuf = new Uint8Array(pixelDataBytes).fill(0)

    const scr = exportSCR(indexBuf, standardConfig)

    // SCR format is always 16384 bytes
    expect(scr.length).toBe(16384)
  })

  it('should accept standard Mode 1 dimensions', () => {
    const standardConfig: CpcModeConfig = {
      overscan: false,
      mode: 1,
      width: 320,
      height: 200,
      nColors: 4,
      scaleX: 1,
      scaleY: 1
    }

    const widthInBytes = standardConfig.width / 4 // 80 bytes
    const pixelDataBytes = widthInBytes * standardConfig.height // 80 × 200 = 16000 bytes

    const indexBuf = new Uint8Array(pixelDataBytes).fill(0)

    const scr = exportSCR(indexBuf, standardConfig)

    // SCR format is always 16384 bytes
    expect(scr.length).toBe(16384)
  })

  it('should accept standard Mode 2 dimensions', () => {
    const standardConfig: CpcModeConfig = {
      overscan: false,
      mode: 2,
      width: 640,
      height: 200,
      nColors: 2,
      scaleX: 1,
      scaleY: 2
    }

    const widthInBytes = standardConfig.width / 8 // 80 bytes
    const pixelDataBytes = widthInBytes * standardConfig.height // 80 × 200 = 16000 bytes

    const indexBuf = new Uint8Array(pixelDataBytes).fill(0)

    const scr = exportSCR(indexBuf, standardConfig)

    // SCR format is always 16384 bytes
    expect(scr.length).toBe(16384)
  })
})

describe('computeCPCAddress - Non-regression tests', () => {
  it('should compute correct addresses for CPC screen interlacing', () => {
    // Test some known addresses
    expect(computeCPCAddress(0, 0)).toBe(0) // First pixel of first line
    expect(computeCPCAddress(0, 1)).toBe(2048) // First pixel of second line (bank 1)
    expect(computeCPCAddress(0, 2)).toBe(4096) // First pixel of third line (bank 2)
    expect(computeCPCAddress(0, 7)).toBe(14336) // First pixel of eighth line (bank 7)
    expect(computeCPCAddress(0, 8)).toBe(80) // First pixel of ninth line (bank 0, line 1)
    expect(computeCPCAddress(0, 9)).toBe(2128) // First pixel of tenth line (bank 1, line 1)
  })
})
