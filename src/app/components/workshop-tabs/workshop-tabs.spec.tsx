import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import WorkshopTabs from './workshop-tabs'

vi.mock('../image-converter/image-converter', () => ({
  default: () => <div>Atelier image</div>
}))

vi.mock('../tileset-workshop/tileset-workshop', () => ({
  default: () => <div>Atelier tileset</div>
}))

describe('WorkshopTabs', () => {
  it('opens on the image workshop', () => {
    renderWithProviders(<WorkshopTabs />)

    expect(screen.getByText('Atelier image')).toBeVisible()
  })

  it('shows the tileset workshop once its tab is picked', async () => {
    renderWithProviders(<WorkshopTabs />)

    await userEvent.click(screen.getByRole('tab', { name: /Tileset/i }))

    expect(await screen.findByText('Atelier tileset')).toBeVisible()
  })

  it('replaces the image workshop rather than sitting beside it', async () => {
    renderWithProviders(<WorkshopTabs />)

    await userEvent.click(screen.getByRole('tab', { name: /Tileset/i }))

    expect(screen.queryByText('Atelier image')).not.toBeInTheDocument()
  })
})
