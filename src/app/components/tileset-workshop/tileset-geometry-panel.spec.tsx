import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { TilesetGeometryPanel } from './tileset-geometry-panel'

describe('TilesetGeometryPanel', () => {
  it('declares the destination size the tiles are cut to', () => {
    renderWithProviders(<TilesetGeometryPanel />)

    expect(screen.getByLabelText(/Largeur cible/i)).toHaveValue(8)
  })

  it('says how far the chosen size is from the source shape', () => {
    renderWithProviders(<TilesetGeometryPanel />)

    // A NES pixel is 8:7, a mode 0 pixel 2:1 — a square tile comes out wide.
    expect(screen.getByLabelText(/Déformation/i)).toHaveTextContent('+75.0 %')
  })

  it('cuts to a shortlisted size when it is picked', async () => {
    renderWithProviders(<TilesetGeometryPanel />)
    const candidate = screen.getAllByRole('button', { name: /x/ })[0]
    const [width] = candidate.textContent?.split(' x ') ?? []

    await userEvent.click(candidate)

    expect(screen.getByLabelText(/Largeur cible/i)).toHaveValue(Number(width))
  })

  it('lets a size the source shape dislikes through, and reports it', async () => {
    renderWithProviders(<TilesetGeometryPanel />)

    await userEvent.type(screen.getByLabelText(/Largeur cible/i), '0')

    expect(screen.getByLabelText(/Largeur cible/i)).toHaveValue(80)
  })
})
