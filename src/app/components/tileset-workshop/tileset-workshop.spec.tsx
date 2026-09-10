import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import { tilesetSettingsOpenAtom } from '@/app/store/tileset/tileset'
import { renderWithProviders } from '@/test-utils'
import TilesetWorkshop from './tileset-workshop'

/**
 * The workshop opens on its settings unless told otherwise. The flag is stored,
 * and `atomWithStorage` re-reads its storage on mount — so the storage is what
 * a test has to write, not the store.
 */
function renderWorkshop(open = true) {
  localStorage.setItem('tileset-settings-open', JSON.stringify(open))
  const store = createStore()
  renderWithProviders(<TilesetWorkshop />, { store })
  return store
}

beforeEach(() => localStorage.clear())

describe('TilesetWorkshop', () => {
  it('docks the settings beside the workspace', () => {
    renderWorkshop()

    expect(screen.getByRole('complementary')).toBeVisible()
  })

  it('opens the docked settings on the grid', () => {
    renderWorkshop()

    expect(screen.getByRole('heading', { name: /Grille source/ })).toBeVisible()
  })

  it('keeps the source sheet out of the dock', () => {
    renderWorkshop()

    expect(
      screen.getByRole('heading', { name: /Planche source/ })
    ).toBeVisible()
  })

  it('offers to reopen the settings once they are closed', () => {
    renderWorkshop(false)

    expect(screen.getByRole('button', { name: 'Réglages' })).toBeVisible()
  })

  it('reopens the settings from the action bar', async () => {
    const store = renderWorkshop(false)

    await userEvent.click(screen.getByRole('button', { name: 'Réglages' }))

    expect(store.get(tilesetSettingsOpenAtom)).toBe(true)
  })

  it('puts the project actions in the action bar', () => {
    renderWorkshop()

    expect(
      screen.getByRole('button', { name: /Exporter le projet/ })
    ).toBeVisible()
  })
})
