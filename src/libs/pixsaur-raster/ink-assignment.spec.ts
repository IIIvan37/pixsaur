import { describe, expect, it } from 'vitest'
import type { Vector } from '../pixsaur-color/src/type'
import { assignColorsToInks } from './ink-assignment'

describe('assignColorsToInks', () => {
  it('returns a copy of the previous palette when the line has no colors', () => {
    const previous: Vector<'RGB'>[] = [
      [10, 10, 10],
      [20, 20, 20]
    ]

    const result = assignColorsToInks([], previous)

    expect(result).toEqual(previous)
  })

  it('does not alias the previous palette when the line is empty', () => {
    const previous: Vector<'RGB'>[] = [[10, 10, 10]]

    const result = assignColorsToInks([], previous)

    expect(result[0]).not.toBe(previous[0])
  })

  it('keeps an exact match in its previous ink position', () => {
    const previous: Vector<'RGB'>[] = [
      [10, 10, 10],
      [20, 20, 20]
    ]

    const result = assignColorsToInks([[20, 20, 20]], previous)

    expect(result[1]).toEqual([20, 20, 20])
  })

  it('assigns a new color to the first unused ink slot', () => {
    const previous: Vector<'RGB'>[] = [
      [10, 10, 10],
      [20, 20, 20]
    ]

    const result = assignColorsToInks([[99, 99, 99]], previous)

    expect(result[0]).toEqual([99, 99, 99])
  })

  it('fills free slots around exact matches', () => {
    const previous: Vector<'RGB'>[] = [
      [10, 10, 10],
      [20, 20, 20]
    ]

    const result = assignColorsToInks(
      [
        [20, 20, 20],
        [99, 99, 99]
      ],
      previous
    )

    expect(result).toEqual([
      [99, 99, 99],
      [20, 20, 20]
    ])
  })

  it('drops line colors that exceed the available ink slots', () => {
    const previous: Vector<'RGB'>[] = [[0, 0, 0]]

    const result = assignColorsToInks(
      [
        [1, 1, 1],
        [2, 2, 2]
      ],
      previous
    )

    expect(result).toEqual([[1, 1, 1]])
  })

  it('does not assign the same line color twice', () => {
    const previous: Vector<'RGB'>[] = [
      [0, 0, 0],
      [9, 9, 9]
    ]

    const result = assignColorsToInks(
      [
        [5, 5, 5],
        [5, 5, 5]
      ],
      previous
    )

    expect(result).toEqual([
      [5, 5, 5],
      [9, 9, 9]
    ])
  })
})
