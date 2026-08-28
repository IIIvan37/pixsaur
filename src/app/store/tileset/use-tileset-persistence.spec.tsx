import { act, renderHook, waitFor } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import {
  TILESET_PROJECT_VERSION,
  type TilesetProject,
  type TilesetProjectStore,
  type TilesetSheet
} from '@/tileset'
import { setTilesetSheetAtom, tilesetSheetAtom } from './tileset'
import { useTilesetPersistence } from './use-tileset-persistence'

const SAVED_SHEET: TilesetSheet = {
  width: 1,
  height: 1,
  data: Uint8ClampedArray.from([1, 1, 1, 255])
}

const OTHER_SHEET: TilesetSheet = {
  width: 1,
  height: 1,
  data: Uint8ClampedArray.from([2, 2, 2, 255])
}

function savedProject(): TilesetProject {
  return {
    version: TILESET_PROJECT_VERSION,
    sheet: SAVED_SHEET,
    source: { tileWidth: 8, tileHeight: 8 },
    target: { tileWidth: 8, tileHeight: 8 },
    mode: 0,
    hardware: 'classic',
    sourcePlatform: 'nes-ntsc',
    options: { resize: 'columns' },
    edits: { strokes: [], at: -1 }
  }
}

function storeOf(
  overrides: Partial<TilesetProjectStore> = {}
): TilesetProjectStore {
  return {
    load: async () => savedProject(),
    save: async () => {},
    clear: async () => {},
    ...overrides
  }
}

function wrapperOf(store: ReturnType<typeof createStore>) {
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
}

describe('useTilesetPersistence', () => {
  it('reopens the workshop on the saved project', async () => {
    const atoms = createStore()

    renderHook(() => useTilesetPersistence(storeOf()), {
      wrapper: wrapperOf(atoms)
    })

    await waitFor(() =>
      expect(atoms.get(tilesetSheetAtom)).toEqual(SAVED_SHEET)
    )
  })

  it('leaves alone a sheet the user imported first', async () => {
    const atoms = createStore()
    atoms.set(setTilesetSheetAtom, OTHER_SHEET)

    renderHook(() => useTilesetPersistence(storeOf()), {
      wrapper: wrapperOf(atoms)
    })

    await waitFor(() => expect(atoms.get(tilesetSheetAtom)).toBe(OTHER_SHEET))
  })

  it('saves the workshop once the user changes it', async () => {
    const atoms = createStore()
    const save = vi.fn(async () => {})

    renderHook(() => useTilesetPersistence(storeOf({ save })), {
      wrapper: wrapperOf(atoms)
    })
    await waitFor(() => expect(atoms.get(tilesetSheetAtom)).not.toBeNull())
    act(() => atoms.set(setTilesetSheetAtom, OTHER_SHEET))

    await waitFor(
      () =>
        expect(save).toHaveBeenCalledWith(
          expect.objectContaining({ sheet: OTHER_SHEET })
        ),
      { timeout: 3000 }
    )
  })

  it('opens an empty workshop when nothing was saved', async () => {
    const atoms = createStore()

    renderHook(
      () => useTilesetPersistence(storeOf({ load: async () => null })),
      {
        wrapper: wrapperOf(atoms)
      }
    )

    await waitFor(() => expect(atoms.get(tilesetSheetAtom)).toBeNull())
  })
})
