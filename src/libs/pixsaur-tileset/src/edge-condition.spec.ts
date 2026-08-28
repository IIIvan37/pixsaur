import { detectTileEdges } from './edge-condition'
import type { SourceTile, TileGrid } from './slice-sheet'

const eight: TileGrid = { tileWidth: 8, tileHeight: 8 }

/** An 8 × 8 tile whose column `x` is uniformly painted `columns[x]`. */
function tileOfColumns(columns: number[]): SourceTile {
  const data = new Uint8ClampedArray(8 * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const at = (y * 8 + x) * 4
      data[at] = columns[x]
      data[at + 3] = 255
    }
  }
  return { data }
}

describe('detectTileEdges', () => {
  it('wraps a tile whose seam is as smooth as its inside', () => {
    const stripes = tileOfColumns([0, 90, 0, 90, 0, 90, 0, 90])

    expect(detectTileEdges(stripes, eight).horizontal).toBe('wrap')
  })

  it('clamps a tile whose seam is a jump its inside never makes', () => {
    const ramp = tileOfColumns([0, 10, 20, 30, 40, 50, 60, 70])

    expect(detectTileEdges(ramp, eight).horizontal).toBe('clamp')
  })

  it('judges the vertical edge on its own rows', () => {
    const ramp = tileOfColumns([0, 10, 20, 30, 40, 50, 60, 70])

    expect(detectTileEdges(ramp, eight).vertical).toBe('wrap')
  })
})
