import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CPCHardware } from '@/libs/types'
import { renderWithProviders } from '@/test-utils'
import { HardwareSettingsView } from './hardware-settings-view'

describe('HardwareSettingsView', () => {
  const mockOnCpcHardwareChange = vi.fn()
  const mockOnPixelModeChange = vi.fn()
  const mockOnDimensionPresetChange = vi.fn()
  const mockOnModeREnabledChange = vi.fn()

  const defaultProps = {
    cpcHardware: 'classic' as CPCHardware,
    onCpcHardwareChange: mockOnCpcHardwareChange,
    pixelMode: 0 as const,
    onPixelModeChange: mockOnPixelModeChange,
    dimensionPreset: 'standard' as const,
    onDimensionPresetChange: mockOnDimensionPresetChange,
    modeREnabled: false,
    onModeREnabledChange: mockOnModeREnabledChange
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders hardware selection', () => {
    renderWithProviders(<HardwareSettingsView {...defaultProps} />)

    expect(screen.getByText('Hardware CPC')).toBeInTheDocument()
    expect(screen.getByText('CPC Classic (27 colors)')).toBeInTheDocument()
    expect(screen.getByText('CPC Plus (4096 colors)')).toBeInTheDocument()
  })

  it('renders pixel mode selection', () => {
    renderWithProviders(<HardwareSettingsView {...defaultProps} />)

    expect(screen.getByText('Mode pixel')).toBeInTheDocument()
    expect(screen.getByText('Mode 0 (160px)')).toBeInTheDocument()
    expect(screen.getByText('Mode 1 (320px)')).toBeInTheDocument()
    expect(screen.getByText('Mode 2 (640px)')).toBeInTheDocument()
  })

  it('renders dimension preset selection', () => {
    renderWithProviders(<HardwareSettingsView {...defaultProps} />)

    expect(screen.getByText('Dimensions')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('Overscan')).toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('shows custom dimensions input when custom preset is selected', () => {
    const props = { ...defaultProps, dimensionPreset: 'custom' as const }
    renderWithProviders(<HardwareSettingsView {...props} />)

    // CustomDimensionsInput should be rendered - check for slider inputs
    expect(screen.getAllByRole('slider').length).toBeGreaterThan(0)
  })

  it('calls onCpcHardwareChange when hardware is clicked', async () => {
    renderWithProviders(<HardwareSettingsView {...defaultProps} />)

    const plusButton = screen.getByRole('button', { name: /CPC Plus/i })
    await userEvent.click(plusButton)

    expect(mockOnCpcHardwareChange).toHaveBeenCalledWith('plus')
  })

  it('calls onPixelModeChange when pixel mode is clicked', async () => {
    renderWithProviders(<HardwareSettingsView {...defaultProps} />)

    const mode1Button = screen.getByRole('button', { name: /Mode 1/i })
    await userEvent.click(mode1Button)

    expect(mockOnPixelModeChange).toHaveBeenCalledWith(1)
  })

  it('calls onDimensionPresetChange when dimension preset is clicked', async () => {
    renderWithProviders(<HardwareSettingsView {...defaultProps} />)

    const overscanButton = screen.getByRole('button', { name: /Overscan/i })
    await userEvent.click(overscanButton)

    expect(mockOnDimensionPresetChange).toHaveBeenCalledWith('overscan')
  })
})
