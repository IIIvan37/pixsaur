import { render, screen, fireEvent } from '@testing-library/react'
import { ToggleButtonGroup } from './toggle-button-group'
import type { ToggleButtonOption } from './toggle-button-group'

describe('ToggleButtonGroup', () => {
  const mockOptions: ToggleButtonOption[] = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' }
  ]

  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  test('renders all options as buttons', () => {
    render(
      <ToggleButtonGroup
        options={mockOptions}
        value="option1"
        onChange={mockOnChange}
      />
    )

    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
    expect(screen.getByText('Option 3')).toBeInTheDocument()
  })

  test('marks selected option as active', () => {
    render(
      <ToggleButtonGroup
        options={mockOptions}
        value="option2"
        onChange={mockOnChange}
      />
    )

    const activeButton = screen.getByText('Option 2')
    const inactiveButton = screen.getByText('Option 1')

    expect(activeButton).toHaveAttribute('aria-pressed', 'true')
    expect(inactiveButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('calls onChange when option is clicked', () => {
    render(
      <ToggleButtonGroup
        options={mockOptions}
        value="option1"
        onChange={mockOnChange}
      />
    )

    fireEvent.click(screen.getByText('Option 2'))
    expect(mockOnChange).toHaveBeenCalledWith('option2')
  })

  test('applies custom aria label prefix', () => {
    render(
      <ToggleButtonGroup
        options={mockOptions}
        value="option1"
        onChange={mockOnChange}
        ariaLabelPrefix="Mode"
      />
    )

    expect(screen.getByLabelText('Mode Option 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Mode Option 2')).toBeInTheDocument()
  })

  test('uses custom aria labels when provided', () => {
    const optionsWithCustomLabels: ToggleButtonOption[] = [
      { value: 'rgb', label: 'RGB', ariaLabel: 'RGB Color Space' },
      { value: 'lab', label: 'Lab', ariaLabel: 'Lab Color Space' }
    ]

    render(
      <ToggleButtonGroup
        options={optionsWithCustomLabels}
        value="rgb"
        onChange={mockOnChange}
      />
    )

    expect(screen.getByLabelText('RGB Color Space')).toBeInTheDocument()
    expect(screen.getByLabelText('Lab Color Space')).toBeInTheDocument()
  })

  test('applies custom className', () => {
    const { container } = render(
      <ToggleButtonGroup
        options={mockOptions}
        value="option1"
        onChange={mockOnChange}
        className="custom-class"
      />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  test('works with numeric values', () => {
    const numericOptions: ToggleButtonOption<number>[] = [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' }
    ]

    const mockNumericOnChange = vi.fn()

    render(
      <ToggleButtonGroup
        options={numericOptions}
        value={1}
        onChange={mockNumericOnChange}
      />
    )

    fireEvent.click(screen.getByText('Two'))
    expect(mockNumericOnChange).toHaveBeenCalledWith(2)
  })
})