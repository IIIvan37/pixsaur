import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { ImageAdjustmentsView } from './image-adjustments-view'

const mockValues = {
  red: 1,
  green: 1,
  blue: 1,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  gamma: 1,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  posterization: 256
}

describe('ImageAdjustmentsView', () => {
  it('renders all adjustment sections', () => {
    const mockOnValueChange = vi.fn()
    const mockOnReset = vi.fn()

    renderWithProviders(
      <ImageAdjustmentsView
        disabled={false}
        values={mockValues}
        onValueChange={mockOnValueChange}
        onReset={mockOnReset}
      />
    )

    expect(screen.getByText('Canaux RGB')).toBeInTheDocument()
    expect(screen.getByText('Couleur & Température')).toBeInTheDocument()
    expect(screen.getByText('Exposition & Tonalité')).toBeInTheDocument()
    expect(screen.getByText('Effets')).toBeInTheDocument()
  })

  it('renders reset button', () => {
    const mockOnValueChange = vi.fn()
    const mockOnReset = vi.fn()

    renderWithProviders(
      <ImageAdjustmentsView
        disabled={false}
        values={mockValues}
        onValueChange={mockOnValueChange}
        onReset={mockOnReset}
      />
    )

    expect(screen.getByText('Réinitialiser')).toBeInTheDocument()
  })

  it('disables controls when disabled prop is true', () => {
    const mockOnValueChange = vi.fn()
    const mockOnReset = vi.fn()

    renderWithProviders(
      <ImageAdjustmentsView
        disabled={true}
        values={mockValues}
        onValueChange={mockOnValueChange}
        onReset={mockOnReset}
      />
    )

    const resetButton = screen.getByText('Réinitialiser')
    expect(resetButton).toBeDisabled()
  })

  it('expands RGB section and shows sliders', async () => {
    const mockOnValueChange = vi.fn()
    const mockOnReset = vi.fn()

    renderWithProviders(
      <ImageAdjustmentsView
        disabled={false}
        values={mockValues}
        onValueChange={mockOnValueChange}
        onReset={mockOnReset}
      />
    )

    const rgbSection = screen.getByText('Canaux RGB')
    const button = rgbSection.closest('button')
    await userEvent.click(button!)

    expect(screen.getByText('Rouge')).toBeInTheDocument()
    expect(screen.getByText('Vert')).toBeInTheDocument()
    expect(screen.getByText('Bleu')).toBeInTheDocument()
  })

  it('expands color section and shows sliders', async () => {
    const mockOnValueChange = vi.fn()
    const mockOnReset = vi.fn()

    renderWithProviders(
      <ImageAdjustmentsView
        disabled={false}
        values={mockValues}
        onValueChange={mockOnValueChange}
        onReset={mockOnReset}
      />
    )

    const colorSection = screen.getByText('Couleur & Température')
    const button = colorSection.closest('button')
    await userEvent.click(button!)

    expect(screen.getByText('Température')).toBeInTheDocument()
    expect(screen.getByText('Teinte colorée')).toBeInTheDocument()
    expect(screen.getByText('Vibrance')).toBeInTheDocument()
    expect(screen.getByText('Saturation')).toBeInTheDocument()
    expect(screen.getByText('Teinte')).toBeInTheDocument()
  })

  it('expands exposure section and shows sliders', async () => {
    const mockOnValueChange = vi.fn()
    const mockOnReset = vi.fn()

    renderWithProviders(
      <ImageAdjustmentsView
        disabled={false}
        values={mockValues}
        onValueChange={mockOnValueChange}
        onReset={mockOnReset}
      />
    )

    const exposureSection = screen.getByText('Exposition & Tonalité')
    const button = exposureSection.closest('button')
    await userEvent.click(button!)

    expect(screen.getByText('Exposition')).toBeInTheDocument()
    expect(screen.getByText('Luminosité')).toBeInTheDocument()
    expect(screen.getByText('Contraste')).toBeInTheDocument()
    expect(screen.getByText('Hautes lumières')).toBeInTheDocument()
    expect(screen.getByText('Ombres')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('expands effects section and shows sliders', async () => {
    const mockOnValueChange = vi.fn()
    const mockOnReset = vi.fn()

    renderWithProviders(
      <ImageAdjustmentsView
        disabled={false}
        values={mockValues}
        onValueChange={mockOnValueChange}
        onReset={mockOnReset}
      />
    )

    const effectsSection = screen.getByText('Effets')
    const button = effectsSection.closest('button')
    await userEvent.click(button!)

    expect(screen.getByText('Posterisation')).toBeInTheDocument()
  })

  it('calls onReset when reset button is clicked', async () => {
    const mockOnValueChange = vi.fn()
    const mockOnReset = vi.fn()

    renderWithProviders(
      <ImageAdjustmentsView
        disabled={false}
        values={mockValues}
        onValueChange={mockOnValueChange}
        onReset={mockOnReset}
      />
    )

    const resetButton = screen.getByText('Réinitialiser')
    await userEvent.click(resetButton)

    expect(mockOnReset).toHaveBeenCalledTimes(1)
  })
})
