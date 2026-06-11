import { describe, expect, it } from 'vitest'
import { DEFAULT_EGX_CONFIG, type EGXConfig } from '@/libs/pixsaur-egx'
import { type PaintPixelsInput, paintPixels } from './paint-pixels'
import { MAX_HISTORY_SIZE } from './types'

/** Deterministic clock so history timestamps are assertable. */
const fixedClock = (now = 1000) => ({ now: () => now })

/** Build an input with sensible defaults; override per test. */
function input(over: Partial<PaintPixelsInput> = {}): PaintPixelsInput {
  return {
    buffer: new Uint8Array([0, 0, 0, 0]),
    width: 2,
    height: 2,
    selectedInk: 5,
    egxConfig: null,
    pixels: [{ x: 0, y: 0 }],
    entryType: 'pixel',
    expandLowResGroups: true,
    history: [],
    historyIndex: -1,
    ...over
  }
}

describe('paintPixels', () => {
  it('paints a single pixel and records a history entry', () => {
    const result = paintPixels(input({ pixels: [{ x: 1, y: 0 }] }), {
      clock: fixedClock(42)
    })

    expect(result.changed).toBe(true)
    expect(result.buffer[1]).toBe(5)
    expect(result.edits).toEqual([
      { x: 1, y: 0, previousInkIndex: 0, newInkIndex: 5 }
    ])
    expect(result.history).toHaveLength(1)
    expect(result.history[0]).toMatchObject({ type: 'pixel', timestamp: 42 })
    expect(result.historyIndex).toBe(0)
  })

  it('does not mutate the input buffer (purity)', () => {
    const buffer = new Uint8Array([0, 0, 0, 0])
    const result = paintPixels(input({ buffer }), { clock: fixedClock() })

    expect(buffer[0]).toBe(0) // original untouched
    expect(result.buffer[0]).toBe(5) // new copy painted
    expect(result.buffer).not.toBe(buffer)
  })

  it('is a no-op when the pixel already has the selected ink', () => {
    const result = paintPixels(
      input({ buffer: new Uint8Array([5, 0, 0, 0]) }),
      { clock: fixedClock() }
    )

    expect(result.changed).toBe(false)
    expect(result.history).toHaveLength(0)
    expect(result.historyIndex).toBe(-1)
  })

  it('ignores out-of-bounds targets', () => {
    const result = paintPixels(
      input({
        pixels: [
          { x: -1, y: 0 },
          { x: 0, y: 10 }
        ]
      }),
      { clock: fixedClock() }
    )

    expect(result.changed).toBe(false)
  })

  it('truncates the redone future before appending a new entry', () => {
    const past = {
      type: 'pixel' as const,
      edits: [{ x: 0, y: 0, previousInkIndex: 0, newInkIndex: 1 }],
      timestamp: 0
    }
    const undoneFuture = {
      type: 'pixel' as const,
      edits: [{ x: 1, y: 0, previousInkIndex: 0, newInkIndex: 2 }],
      timestamp: 0
    }

    const result = paintPixels(
      input({
        pixels: [{ x: 1, y: 1 }],
        history: [past, undoneFuture],
        historyIndex: 0 // sitting on `past`, `undoneFuture` is redo-able
      }),
      { clock: fixedClock() }
    )

    // The undone future is dropped, the new entry replaces it.
    expect(result.history).toHaveLength(2)
    expect(result.history[0]).toBe(past)
    expect(result.history[1].edits[0]).toMatchObject({ x: 1, y: 1 })
    expect(result.historyIndex).toBe(1)
  })

  it('caps the history at MAX_HISTORY_SIZE, dropping the oldest', () => {
    const full = Array.from({ length: MAX_HISTORY_SIZE }, (_, i) => ({
      type: 'pixel' as const,
      edits: [{ x: 0, y: 0, previousInkIndex: 0, newInkIndex: i }],
      timestamp: i
    }))

    const result = paintPixels(
      input({
        pixels: [{ x: 1, y: 1 }],
        history: full,
        historyIndex: MAX_HISTORY_SIZE - 1
      }),
      { clock: fixedClock(999) }
    )

    expect(result.history).toHaveLength(MAX_HISTORY_SIZE)
    expect(result.history[0].timestamp).toBe(1) // entry 0 dropped
    expect(result.history[MAX_HISTORY_SIZE - 1].timestamp).toBe(999)
    expect(result.historyIndex).toBe(MAX_HISTORY_SIZE - 1)
  })

  describe('drag stroke (region)', () => {
    it('paints several pixels in one region entry', () => {
      const result = paintPixels(
        input({
          pixels: [
            { x: 0, y: 0 },
            { x: 1, y: 1 }
          ],
          selectedInk: 3,
          entryType: 'region',
          expandLowResGroups: false
        }),
        { clock: fixedClock() }
      )

      expect(result.buffer[0]).toBe(3)
      expect(result.buffer[3]).toBe(3)
      expect(result.history[0].type).toBe('region')
      expect(result.history[0].edits).toHaveLength(2)
    })

    it('skips same-color and repeated pixels within the stroke', () => {
      const result = paintPixels(
        input({
          buffer: new Uint8Array([3, 0, 0, 0]),
          // (0,0) already ink 3; (1,0) appears twice
          pixels: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 0 }
          ],
          selectedInk: 3,
          entryType: 'region',
          expandLowResGroups: false
        }),
        { clock: fixedClock() }
      )

      expect(result.edits).toHaveLength(1)
      expect(result.edits[0]).toMatchObject({ x: 1, y: 0 })
    })

    it('produces no entry when nothing changes', () => {
      const result = paintPixels(
        input({
          buffer: new Uint8Array([3, 3, 3, 3]),
          pixels: [{ x: 0, y: 0 }],
          selectedInk: 3,
          entryType: 'region',
          expandLowResGroups: false
        }),
        { clock: fixedClock() }
      )

      expect(result.changed).toBe(false)
      expect(result.history).toHaveLength(0)
    })
  })

  describe('EGX constraints', () => {
    // EGX1, firstLineMode 'low': even lines = Mode 0 (low-res, 2-wide pixels,
    // inks 0-15), odd lines = Mode 1 (high-res, inks 0-3).
    const egx1: EGXConfig = { ...DEFAULT_EGX_CONFIG, type: 'egx1' }

    it('expands a low-res line click to the 2-wide CPC pixel group', () => {
      const result = paintPixels(
        {
          buffer: new Uint8Array(8), // width 4 × height 2
          width: 4,
          height: 2,
          selectedInk: 7,
          egxConfig: egx1,
          pixels: [{ x: 1, y: 0 }], // line 0 = low-res; x aligns to 0
          entryType: 'pixel',
          expandLowResGroups: true,
          history: [],
          historyIndex: -1
        },
        { clock: fixedClock() }
      )

      expect(result.edits).toHaveLength(2)
      expect(result.buffer[0]).toBe(7) // aligned x
      expect(result.buffer[1]).toBe(7) // right neighbour
    })

    it('skips painting an ink beyond the line color limit', () => {
      const result = paintPixels(
        {
          buffer: new Uint8Array(8),
          width: 4,
          height: 2,
          selectedInk: 5, // > 3, exceeds Mode 1 (high-res) limit
          egxConfig: egx1,
          pixels: [{ x: 0, y: 1 }], // line 1 = high-res, inks 0-3 only
          entryType: 'pixel',
          expandLowResGroups: true,
          history: [],
          historyIndex: -1
        },
        { clock: fixedClock() }
      )

      expect(result.changed).toBe(false)
    })
  })
})
