import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { ResizeSettingsView } from './resize-settings-view'

describe('ResizeSettingsView', () => {
  const mockOnResizeModeChange = vi.fn()
  const mockOnCenterImageChange = vi.fn()

  const mockOnMode0FilterChange = vi.fn()

  const defaultProps = {
    resizeMode: 'auto' as const,
    onResizeModeChange: mockOnResizeModeChange,
    selection: null,
    centerImage: false,
    onCenterImageChange: mockOnCenterImageChange,
    showMode0Filter: false,
    mode0Filter: 'lanczos2' as const,
    onMode0FilterChange: mockOnMode0FilterChange
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders resize mode options', () => {
    renderWithProviders(<ResizeSettingsView {...defaultProps} />)

    expect(screen.getByText('Mode de redimensionnement')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Auto/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Origin/i })).toBeInTheDocument()
  })

  it('renders center image toggle', () => {
    renderWithProviders(<ResizeSettingsView {...defaultProps} />)

    expect(screen.getByText("Centrage de l'image")).toBeInTheDocument()
    expect(screen.getByLabelText(/Centrer l'image/i)).toBeInTheDocument()
  })

  it('shows selection info when selection exists', () => {
    const propsWithSelection = {
      ...defaultProps,
      selection: { sx: 0, sy: 0, width: 320, height: 200 }
    }

    renderWithProviders(<ResizeSettingsView {...propsWithSelection} />)

    expect(screen.getByText(/320 × 200 px/i)).toBeInTheDocument()
  })

  it('does not show selection info when selection is null', () => {
    renderWithProviders(<ResizeSettingsView {...defaultProps} />)

    expect(screen.queryByText(/×.*px/i)).not.toBeInTheDocument()
  })

  it('calls onResizeModeChange when mode is clicked', async () => {
    renderWithProviders(<ResizeSettingsView {...defaultProps} />)

    const originRadio = screen.getByRole('radio', { name: /Origin/i })
    await userEvent.click(originRadio)

    expect(mockOnResizeModeChange).toHaveBeenCalledWith('origin')
  })

  it('calls onCenterImageChange when switch is toggled', async () => {
    renderWithProviders(<ResizeSettingsView {...defaultProps} />)

    const centerSwitch = screen.getByRole('switch', {
      name: /Centrer l'image/i
    })

    await userEvent.click(centerSwitch)

    expect(mockOnCenterImageChange).toHaveBeenCalledWith(true)
  })

  it('reflects correct checked state for resize mode', () => {
    renderWithProviders(<ResizeSettingsView {...defaultProps} />)

    const autoRadio = screen.getByRole('radio', { name: /Auto/i })
    const originRadio = screen.getByRole('radio', { name: /Origin/i })

    expect(autoRadio).toBeChecked()
    expect(originRadio).not.toBeChecked()
  })

  it('hides the mode 0 filter selector when showMode0Filter is false', () => {
    renderWithProviders(<ResizeSettingsView {...defaultProps} />)

    expect(
      screen.queryByRole('radio', { name: /Lanczos/i })
    ).not.toBeInTheDocument()
  })

  it('shows the mode 0 filter selector when showMode0Filter is true', () => {
    renderWithProviders(
      <ResizeSettingsView {...defaultProps} showMode0Filter />
    )

    expect(screen.getByRole('radio', { name: /Box/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Tent/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Lanczos/i })).toBeChecked()
  })

  it('calls onMode0FilterChange when a filter is clicked', async () => {
    renderWithProviders(
      <ResizeSettingsView {...defaultProps} showMode0Filter />
    )

    await userEvent.click(screen.getByRole('radio', { name: /Box/i }))

    expect(mockOnMode0FilterChange).toHaveBeenCalledWith('box')
  })

  it('reflects correct checked state for center image switch', () => {
    const propsWithCentered = { ...defaultProps, centerImage: true }
    renderWithProviders(<ResizeSettingsView {...propsWithCentered} />)

    const centerSwitch = screen.getByRole('switch', {
      name: /Centrer l'image/i
    })

    expect(centerSwitch.getAttribute('aria-checked')).toBe('true')
  })
})
