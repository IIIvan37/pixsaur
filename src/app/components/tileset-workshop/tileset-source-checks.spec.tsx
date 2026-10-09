import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import {
  setTilesetSheetAtom,
  tilesetSheetAtom
} from '@/app/store/tileset/tileset'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { renderWithProviders } from '@/test-utils'
import { TilesetSourceChecks } from './tileset-source-checks'

/** A capture blown up twice: 8 x 2 pixels, two colours in 2 x 2 blocks. */
function captureBlownUpTwice(): Sheet {
  const data = new Uint8ClampedArray(8 * 2 * 4)
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 8; x++) {
      data[(y * 8 + x) * 4] = Math.floor(x / 2) % 2 === 0 ? 0 : 200
      data[(y * 8 + x) * 4 + 3] = 255
    }
  }
  return { width: 8, height: 2, data }
}

/** 600 pixels of 600 colours: what a bilinear filter leaves behind. */
function filteredCapture(): Sheet {
  const data = new Uint8ClampedArray(600 * 4)
  for (let x = 0; x < 600; x++) {
    data[x * 4] = x % 256
    data[x * 4 + 1] = Math.floor(x / 256)
    data[x * 4 + 3] = 255
  }
  return { width: 600, height: 1, data }
}

/** One black 8 x 8 tile, at its own size. */
function captureOfOneColour(): Sheet {
  const data = new Uint8ClampedArray(8 * 8 * 4)
  for (let at = 3; at < data.length; at += 4) data[at] = 255
  return { width: 8, height: 8, data }
}

function storeWith(sheet: Sheet) {
  const store = createStore()
  store.set(setTilesetSheetAtom, sheet)
  return store
}

describe('TilesetSourceChecks', () => {
  it('offers to reduce a capture blown up twice', () => {
    renderWithProviders(<TilesetSourceChecks />, {
      store: storeWith(captureBlownUpTwice())
    })

    expect(screen.getByRole('status')).toHaveTextContent(/×2/)
  })

  it('brings the capture back to its own size when asked', async () => {
    const store = storeWith(captureBlownUpTwice())
    renderWithProviders(<TilesetSourceChecks />, { store })

    await userEvent.click(
      screen.getByRole('button', { name: /Réduire à la taille d'origine/i })
    )

    expect(store.get(tilesetSheetAtom)?.width).toBe(4)
  })

  it('warns that a capture of too many colours looks filtered', () => {
    renderWithProviders(<TilesetSourceChecks />, {
      store: storeWith(filteredCapture())
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/filtrée/i)
  })

  it('says nothing of a source that passes both checks', () => {
    const { container } = renderWithProviders(<TilesetSourceChecks />, {
      store: storeWith(captureOfOneColour())
    })

    expect(container).toBeEmptyDOMElement()
  })
})
