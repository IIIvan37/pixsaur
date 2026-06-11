import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { DEFAULT_EGX_CONFIG } from '@/libs/pixsaur-egx'
import { type EnterEditModeInput, enterEditMode } from './enter-edit-mode'

/** Build an input with sensible defaults; override per test. */
function input(over: Partial<EnterEditModeInput> = {}): EnterEditModeInput {
  return {
    effective: {
      buffer: new Uint8Array([1, 2, 3, 4]),
      width: 2,
      height: 2,
      palette: [
        [10, 20, 30],
        [40, 50, 60]
      ]
    },
    baseBufferRaw: null,
    egxEnabled: false,
    egxConfig: null,
    egxType: 'egx1',
    configPixelMode: 0,
    rasterChanges: [],
    ...over
  }
}

describe('enterEditMode', () => {
  it('copies the effective buffer as the working edit buffer', () => {
    const effective = {
      buffer: new Uint8Array([1, 2, 3, 4]),
      width: 2,
      height: 2,
      palette: [[0, 0, 0]] as Vector<'RGB'>[]
    }
    const session = enterEditMode(input({ effective }))

    expect(session.editBuffer).toEqual(effective.buffer)
    // A copy, not the same reference — mutating the input must not leak.
    expect(session.editBuffer).not.toBe(effective.buffer)
    effective.buffer[0] = 99
    expect(session.editBuffer[0]).toBe(1)
  })

  it('uses the raw base buffer for originalBuffer when provided', () => {
    const baseBufferRaw = new Uint8Array([7, 7, 7, 7])
    const session = enterEditMode(input({ baseBufferRaw }))

    expect(session.originalBuffer).toEqual(baseBufferRaw)
    expect(session.originalBuffer).not.toBe(baseBufferRaw)
  })

  it('falls back to the effective buffer for originalBuffer when no raw base', () => {
    const session = enterEditMode(
      input({
        baseBufferRaw: null,
        effective: {
          buffer: new Uint8Array([5, 6, 7, 8]),
          width: 2,
          height: 2,
          palette: [[0, 0, 0]]
        }
      })
    )

    expect(Array.from(session.originalBuffer)).toEqual([5, 6, 7, 8])
  })

  it('carries dimensions from the effective buffer', () => {
    const session = enterEditMode(
      input({
        effective: {
          buffer: new Uint8Array(12),
          width: 4,
          height: 3,
          palette: [[0, 0, 0]]
        }
      })
    )

    expect(session.dimensions).toEqual({ width: 4, height: 3 })
  })

  it('keeps the EGX config only when EGX is enabled', () => {
    const enabled = enterEditMode(
      input({ egxEnabled: true, egxConfig: DEFAULT_EGX_CONFIG })
    )
    expect(enabled.egxEnabled).toBe(true)
    expect(enabled.egxConfig).toBe(DEFAULT_EGX_CONFIG)

    const disabled = enterEditMode(
      input({ egxEnabled: false, egxConfig: DEFAULT_EGX_CONFIG })
    )
    expect(disabled.egxEnabled).toBe(false)
    expect(disabled.egxConfig).toBeNull()
  })

  it('derives pixel mode 1 for EGX1 and 2 for EGX2', () => {
    expect(
      enterEditMode(input({ egxEnabled: true, egxType: 'egx1' })).pixelMode
    ).toBe(1)
    expect(
      enterEditMode(input({ egxEnabled: true, egxType: 'egx2' })).pixelMode
    ).toBe(2)
  })

  it('uses the config pixel mode when EGX is disabled', () => {
    expect(
      enterEditMode(input({ egxEnabled: false, configPixelMode: 0 })).pixelMode
    ).toBe(0)
    expect(
      enterEditMode(input({ egxEnabled: false, configPixelMode: 2 })).pixelMode
    ).toBe(2)
  })

  it('deep-copies the palette so edits do not alias the source', () => {
    const palette = [
      [10, 20, 30],
      [40, 50, 60]
    ] as Vector<'RGB'>[]
    const session = enterEditMode(
      input({
        effective: {
          buffer: new Uint8Array([0]),
          width: 1,
          height: 1,
          palette
        }
      })
    )

    expect(session.basePalette).toEqual(palette)
    palette[0][0] = 99
    expect(session.basePalette[0][0]).toBe(10)
  })

  it('copies the raster changes array (new reference)', () => {
    const rasterChanges = [{ line: 0, inkIndex: 1, color: [1, 2, 3] }] as never
    const session = enterEditMode(input({ rasterChanges }))

    expect(session.rasterChanges).toEqual(rasterChanges)
    expect(session.rasterChanges).not.toBe(rasterChanges)
  })
})
