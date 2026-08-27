import { render } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
import { egxEnabledAtom } from '@/app/store/config/egx'
import { modeREnabledAtom } from '@/app/store/config/mode-r'
import { editorModeAtom } from '@/app/store/editor'
import { imageAtom } from '@/app/store/image/image'
import { rasterChangesAtom, rasterEnabledAtom } from '@/app/store/raster/raster'
import PreviewPanel from './preview-panel'

// The three children read the whole preview pipeline; this spec is about the
// panel's own dispatch, so they are stubbed out.
vi.mock('@/preview', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    ImagePreview: () => <div data-testid='mock-image-preview' />
  }
})
vi.mock('@/components/color-palette/color-palette', () => ({
  ColorPalette: () => <div data-testid='mock-color-palette' />
}))
vi.mock('@/components/color-palette/raster-base-palette', () => ({
  RasterBasePalette: () => <div data-testid='mock-raster-base-palette' />
}))
vi.mock('@/components/image-controls/image-controls', () => ({
  default: () => <div data-testid='mock-image-controls' />
}))

/** A store with an image loaded and every alternate rendering path off. */
function storeWithImage() {
  const store = createStore()
  store.set(imageAtom, {} as HTMLImageElement)
  store.set(modeREnabledAtom, false)
  store.set(egxEnabledAtom, false)
  store.set(rasterEnabledAtom, false)
  store.set(rasterChangesAtom, [])
  store.set(editorModeAtom, false)
  return store
}

function renderWith(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <PreviewPanel />
    </Provider>
  )
}

describe('PreviewPanel', () => {
  it("cache le bouton Éditer si aucune image n'est chargée", () => {
    const store = storeWithImage()
    store.set(imageAtom, null)
    expect(renderWith(store).queryByText('Éditer')).toBeNull()
  })

  it('affiche le bouton Éditer si une image est chargée', () => {
    expect(renderWith(storeWithImage()).getByText('Éditer')).toBeInTheDocument()
  })

  it("cache le bouton Éditer sur un chemin qui ne déclare pas l'éditeur", () => {
    const store = storeWithImage()
    store.set(modeREnabledAtom, true)
    expect(renderWith(store).queryByText('Éditer')).toBeNull()
  })

  it("cache le bouton Éditer pendant l'édition", () => {
    const store = storeWithImage()
    store.set(editorModeAtom, true)
    expect(renderWith(store).queryByText('Éditer')).toBeNull()
  })

  it('affiche la palette standard hors chemin raster', () => {
    expect(
      renderWith(storeWithImage()).getByTestId('mock-color-palette')
    ).toBeInTheDocument()
  })

  it('affiche la palette de base raster sur le chemin raster', () => {
    const store = storeWithImage()
    store.set(rasterEnabledAtom, true)
    store.set(rasterChangesAtom, [
      { id: 'c1', line: 10, inkIndex: 0, color: [0, 0, 0] }
    ] as never)
    expect(
      renderWith(store).getByTestId('mock-raster-base-palette')
    ).toBeInTheDocument()
  })

  it('affiche la palette standard quand le raster est activé sans changement', () => {
    const store = storeWithImage()
    store.set(rasterEnabledAtom, true)
    expect(
      renderWith(store).getByTestId('mock-color-palette')
    ).toBeInTheDocument()
  })
})
