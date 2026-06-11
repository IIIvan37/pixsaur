import type { PaletteSlot } from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { type ReducePaletteInput, reducePalette } from './reduce-palette'

const empty = (): PaletteSlot => ({ color: null, locked: false })
const slots = (n = 16): PaletteSlot[] => new Array(n).fill(null).map(empty)

function input(over: Partial<ReducePaletteInput> = {}): ReducePaletteInput {
  return {
    reduced: [],
    prev: slots(),
    maxColors: 16,
    ...over
  }
}

describe('reducePalette', () => {
  it('fills unlocked slots from the reduced colors and clears the rest', () => {
    const reduced: Vector<'RGB'>[] = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ]

    const result = reducePalette(input({ reduced }))

    expect(result).toHaveLength(16)
    expect(result[0]).toEqual({ color: [255, 0, 0], locked: false })
    expect(result[1]).toEqual({ color: [0, 255, 0], locked: false })
    expect(result[2]).toEqual({ color: [0, 0, 255], locked: false })
    expect(result.slice(3).every((s) => s.color === null && !s.locked)).toBe(
      true
    )
  })

  it('preserves locked slots and skips them when distributing colors', () => {
    const prev = slots()
    prev[0] = { color: [255, 0, 0], locked: true }

    const reduced: Vector<'RGB'>[] = [
      [255, 255, 0],
      [255, 0, 255]
    ]

    const result = reducePalette(input({ prev, reduced }))

    expect(result[0]).toEqual({ color: [255, 0, 0], locked: true })
    expect(result[1]).toEqual({ color: [255, 255, 0], locked: false })
    expect(result[2]).toEqual({ color: [255, 0, 255], locked: false })
  })

  it('drops reduced colors too close to a locked color', () => {
    const prev = slots()
    prev[0] = { color: [255, 0, 0], locked: true }

    const reduced: Vector<'RGB'>[] = [
      [255, 0, 0], // identical to the locked color → dropped
      [0, 0, 255]
    ]

    const result = reducePalette(input({ prev, reduced }))

    expect(result[0]).toEqual({ color: [255, 0, 0], locked: true })
    // The duplicate was filtered, so the next free slot gets the blue.
    expect(result[1]).toEqual({ color: [0, 0, 255], locked: false })
    expect(result[2]).toEqual({ color: null, locked: false })
  })

  it('respects the mode color budget (maxColors)', () => {
    const reduced: Vector<'RGB'>[] = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
      [255, 0, 255] // beyond the 4-color budget → never placed
    ]

    const result = reducePalette(input({ reduced, maxColors: 4 }))

    expect(result.slice(0, 4).every((s) => s.color !== null)).toBe(true)
    expect(result.slice(4).every((s) => s.color === null && !s.locked)).toBe(
      true
    )
  })

  it('clears colors outside the mode budget but keeps their locked flag', () => {
    const prev = slots()
    // A locked slot sitting beyond the active 4-color mode budget.
    prev[6] = { color: [10, 20, 30], locked: true }

    const result = reducePalette(input({ prev, maxColors: 4 }))

    expect(result[6]).toEqual({ color: null, locked: true })
  })
})
