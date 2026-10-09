import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import {
  setTilesetLayoutAtom,
  setTilesetMapOptionsAtom,
  setTilesetSheetAtom,
  tilesetMapAtom
} from '@/app/store/tileset/tileset'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { renderWithProviders } from '@/test-utils'
import { TilesetMergeList } from './tileset-merge-list'

/** A map of one row: a white cell, a black one, a white one again. */
function mapOfThreeCells(): Sheet {
  const width = 3 * 8
  const data = new Uint8ClampedArray(width * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      const white = Math.floor(x / 8) !== 1
      data[at] = white ? 255 : 0
      data[at + 1] = white ? 255 : 0
      data[at + 2] = white ? 255 : 0
      data[at + 3] = 255
    }
  }
  return { width, height: 8, data }
}

function storeWithMap() {
  const store = createStore()
  store.set(setTilesetSheetAtom, mapOfThreeCells())
  store.set(setTilesetLayoutAtom, 'map')
  return store
}

describe('TilesetMergeList', () => {
  it('shows nothing while no tile is merged', () => {
    const { container } = renderWithProviders(<TilesetMergeList />, {
      store: storeWithMap()
    })

    expect(container).toBeEmptyDOMElement()
  })

  it('lists the merges the threshold made', () => {
    const store = storeWithMap()
    store.set(setTilesetMapOptionsAtom, { mergeThreshold: 9999999 })

    renderWithProviders(<TilesetMergeList />, { store })

    expect(screen.getByRole('listitem')).toHaveTextContent('#2 → #1')
  })

  it('keeps a merge apart when the user excludes it', async () => {
    const store = storeWithMap()
    store.set(setTilesetMapOptionsAtom, { mergeThreshold: 9999999 })
    renderWithProviders(<TilesetMergeList />, { store })

    await userEvent.click(
      screen.getByRole('button', { name: /Garder à part/i })
    )

    expect(store.get(tilesetMapAtom)?.cells).toEqual([0, 1, 0])
  })
})
