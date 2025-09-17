import { fireEvent, render, screen } from '@testing-library/react'
import { Switch } from './switch'

describe('Switch', () => {
  it('renders with label', () => {
    const testId = crypto.randomUUID()
    render(
      <Switch
        checked={false}
        onCheckedChange={() => {}}
        label='Enable feature'
        id={testId}
      />
    )
    expect(screen.getByLabelText('Enable feature')).toBeInTheDocument()
  })

  it('renders without label', () => {
    const testId = crypto.randomUUID()
    render(<Switch checked={false} onCheckedChange={() => {}} id={testId} />)
    // Should still render the switch input
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('calls onCheckedChange when toggled', () => {
    const handleChange = vi.fn()
    const testId = crypto.randomUUID()
    render(
      <Switch
        checked={false}
        onCheckedChange={handleChange}
        label='Toggle me'
        id={testId}
      />
    )
    const switchEl = screen.getByRole('switch')
    fireEvent.click(switchEl)
    expect(handleChange).toHaveBeenCalled()
  })

  it('is checked when checked prop is true', () => {
    const testId = crypto.randomUUID()
    render(
      <Switch
        checked={true}
        onCheckedChange={() => {}}
        label='Checked'
        id={testId}
      />
    )
    const switchEl = screen.getByRole('switch')
    expect(switchEl).toHaveAttribute('aria-checked', 'true')
  })
})
