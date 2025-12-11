import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { HardwareSettings } from './hardware-settings'

describe('HardwareSettings', () => {
  it('renders hardware selection', () => {
    renderWithProviders(<HardwareSettings />)

    expect(screen.getByText('Hardware CPC')).toBeInTheDocument()
    expect(screen.getByText('CPC Classic (27 colors)')).toBeInTheDocument()
    expect(screen.getByText('CPC Plus (4096 colors)')).toBeInTheDocument()
  })

  it('renders pixel mode selection', () => {
    renderWithProviders(<HardwareSettings />)

    expect(screen.getByText('Mode pixel')).toBeInTheDocument()
    expect(screen.getByText('Mode 0 (160px)')).toBeInTheDocument()
    expect(screen.getByText('Mode 1 (320px)')).toBeInTheDocument()
    expect(screen.getByText('Mode 2 (640px)')).toBeInTheDocument()
  })

  it('renders dimension preset selection', () => {
    renderWithProviders(<HardwareSettings />)

    expect(screen.getByText('Dimensions')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('Overscan')).toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('shows custom dimensions input when custom preset is selected', async () => {
    renderWithProviders(<HardwareSettings />)

    const customButton = screen.getByRole('button', { name: /Custom/i })
    await userEvent.click(customButton)

    // CustomDimensionsInput should be rendered - check for slider inputs
    expect(screen.getAllByRole('slider').length).toBeGreaterThan(0)
  })

  it('allows switching between hardware types', async () => {
    renderWithProviders(<HardwareSettings />)

    const plusButton = screen.getByRole('button', { name: /CPC Plus/i })
    await userEvent.click(plusButton)

    expect(plusButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('allows switching between pixel modes', async () => {
    renderWithProviders(<HardwareSettings />)

    const mode1Button = screen.getByRole('button', { name: /Mode 1/i })
    await userEvent.click(mode1Button)

    expect(mode1Button).toHaveAttribute('aria-pressed', 'true')
  })
})
