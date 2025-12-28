import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PreviewPanel from './preview-panel'

let mockValues: any[] = []
vi.mock('jotai', async (importOriginal) => {
  const actual = await importOriginal()
  return Object.assign({}, actual, {
    useAtomValue: () => mockValues.shift(),
    useSetAtom: () => vi.fn()
  })
})

// Mock ImagePreview, ColorPalette, and RasterBasePalette to avoid atom errors in subcomponents
vi.mock('@/preview', async (importOriginal) => {
  const actual = await importOriginal()
  return Object.assign({}, actual, {
    ImagePreview: () => <div data-testid='mock-image-preview' />
  })
})
vi.mock('@/components/color-palette/color-palette', () => ({
  ColorPalette: () => <div data-testid='mock-color-palette' />
}))
vi.mock('@/components/color-palette/raster-base-palette', () => ({
  RasterBasePalette: () => <div data-testid='mock-raster-base-palette' />
}))

describe('PreviewPanel', () => {
  afterEach(() => {
    mockValues = []
  })

  it("cache le bouton Éditer si aucune image n'est chargée", () => {
    mockValues = [false, false, null] // rasterEnabledAtom, editorModeAtom, imageAtom
    const { queryByText } = render(<PreviewPanel />)
    expect(queryByText('Éditer')).toBeNull()
  })

  it('affiche le bouton Éditer si une image est chargée', () => {
    mockValues = [false, false, {}] // rasterEnabledAtom, editorModeAtom, imageAtom
    const { getByText } = render(<PreviewPanel />)
    expect(getByText('Éditer')).toBeInTheDocument()
  })
})
