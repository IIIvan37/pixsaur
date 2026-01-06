import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PreviewPanel from './preview-panel'

let mockValues: any[] = []
vi.mock('jotai', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useAtomValue: () => mockValues.shift(),
    useSetAtom: () => vi.fn()
  }
})

// Mock ImagePreview, ColorPalette, and RasterBasePalette to avoid atom errors in subcomponents
vi.mock('@/preview', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
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

describe('PreviewPanel', () => {
  afterEach(() => {
    mockValues = []
  })

  it("cache le bouton Éditer si aucune image n'est chargée", () => {
    // Order: rasterEnabledAtom, modeREnabledAtom, editorModeAtom, imageAtom
    mockValues = [false, false, false, null]
    const { queryByText } = render(<PreviewPanel />)
    expect(queryByText('Éditer')).toBeNull()
  })

  it('affiche le bouton Éditer si une image est chargée', () => {
    // Order: rasterEnabledAtom, modeREnabledAtom, editorModeAtom, imageAtom
    mockValues = [false, false, false, {}]
    const { getByText } = render(<PreviewPanel />)
    expect(getByText('Éditer')).toBeInTheDocument()
  })

  it('cache le bouton Éditer si Mode R est activé', () => {
    // Order: rasterEnabledAtom, modeREnabledAtom, editorModeAtom, imageAtom
    mockValues = [false, true, false, {}]
    const { queryByText } = render(<PreviewPanel />)
    expect(queryByText('Éditer')).toBeNull()
  })
})
