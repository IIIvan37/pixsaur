import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CustomDimensionsView } from './custom-dimensions-view'

describe('CustomDimensionsView', () => {
  const mockValidation = {
    valid: true,
    widthInBytes: 80,
    bytes: 16000,
    kb: 15.625,
    errors: []
  }

  const mockPresets = [
    { name: 'Standard 160×200', width: 160, height: 200 },
    { name: 'Small 128×128', width: 128, height: 128 }
  ]

  const defaultProps = {
    width: 160,
    height: 200,
    widthStep: 4,
    heightStep: 8,
    validation: mockValidation,
    presets: mockPresets,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    onPresetClick: vi.fn()
  }

  it('should render width and height inputs', () => {
    render(<CustomDimensionsView {...defaultProps} />)

    const widthInput = screen.getByLabelText(/Width/)
    const heightInput = screen.getByLabelText(/Height/)

    expect(widthInput).toBeInTheDocument()
    expect(heightInput).toBeInTheDocument()
    expect(widthInput).toHaveValue(160)
    expect(heightInput).toHaveValue(200)
  })

  it('should render preset buttons', () => {
    render(<CustomDimensionsView {...defaultProps} />)

    expect(screen.getByText('Standard 160×200')).toBeInTheDocument()
    expect(screen.getByText('Small 128×128')).toBeInTheDocument()
  })

  it('should show validation success message', () => {
    render(<CustomDimensionsView {...defaultProps} />)

    expect(screen.getByText(/15.63 Ko \/ 64 Ko/)).toBeInTheDocument()
    expect(screen.getByText(/80 bytes\/line × 200 lines/)).toBeInTheDocument()
  })

  it('should show validation error message', () => {
    const invalidValidation = {
      valid: false,
      widthInBytes: 81,
      bytes: 16200,
      kb: 15.82,
      errors: [
        'Width must be multiple of 4 for Mode 0',
        'Width in bytes (81) must be even'
      ]
    }

    render(
      <CustomDimensionsView {...defaultProps} validation={invalidValidation} />
    )

    expect(
      screen.getByText(/Width must be multiple of 4 for Mode 0/)
    ).toBeInTheDocument()
    expect(screen.getByText(/\+1 more/)).toBeInTheDocument()
  })

  it('should call onWidthChange when width input changes', () => {
    const onWidthChange = vi.fn()

    render(
      <CustomDimensionsView {...defaultProps} onWidthChange={onWidthChange} />
    )

    const widthInput = screen.getByLabelText(/Width/)

    // Simulate direct value change
    fireEvent.change(widthInput, { target: { value: '320' } })

    // Check onChange was called with parsed number
    expect(onWidthChange).toHaveBeenCalledWith(320)
  })

  it('should call onHeightChange when height input changes', () => {
    const onHeightChange = vi.fn()

    render(
      <CustomDimensionsView {...defaultProps} onHeightChange={onHeightChange} />
    )

    const heightInput = screen.getByLabelText(/Height/)

    // Simulate direct value change
    fireEvent.change(heightInput, { target: { value: '256' } })

    // Check onChange was called with parsed number
    expect(onHeightChange).toHaveBeenCalledWith(256)
  })

  it('should call onPresetClick when preset button is clicked', async () => {
    const user = userEvent.setup()
    render(<CustomDimensionsView {...defaultProps} />)

    const presetButton = screen.getByText('Small 128×128')
    await user.click(presetButton)

    expect(defaultProps.onPresetClick).toHaveBeenCalledWith(128, 128)
  })

  it('should apply error class to invalid width input', () => {
    const invalidValidation = {
      ...mockValidation,
      valid: false,
      errors: ['Width must be multiple of 4 for Mode 0']
    }

    render(
      <CustomDimensionsView {...defaultProps} validation={invalidValidation} />
    )

    const widthInput = screen.getByLabelText(/Width/)
    // CSS modules generate hashed class names, check if error class is present
    expect(widthInput.className).toMatch(/inputError/)
  })

  it('should apply error class to invalid height input', () => {
    const invalidValidation = {
      ...mockValidation,
      valid: false,
      errors: ['Height must be multiple of 8 (CPC interlacing)']
    }

    render(
      <CustomDimensionsView {...defaultProps} validation={invalidValidation} />
    )

    const heightInput = screen.getByLabelText(/Height/)
    // CSS modules generate hashed class names, check if error class is present
    expect(heightInput.className).toMatch(/inputError/)
  })

  it('should have correct step values on inputs', () => {
    render(<CustomDimensionsView {...defaultProps} />)

    const widthInput = screen.getByLabelText(/Width/)
    const heightInput = screen.getByLabelText(/Height/)

    expect(widthInput).toHaveAttribute('step', '4')
    expect(heightInput).toHaveAttribute('step', '8')
  })
})
