import { render, screen, fireEvent } from '@testing-library/react'
import { Switch } from './switch'

describe('Switch', () => {
  it('renders with label', () => {
    render(
      <Switch
        checked={false}
        onCheckedChange={() => {}}
        label='Enable feature'
        id='test-switch'
      />
    )
    expect(screen.getByLabelText('Enable feature')).toBeInTheDocument()
  })

  it('renders without label', () => {
    render(
      <Switch checked={false} onCheckedChange={() => {}} id='test-switch' />
    )
    // Should still render the switch input
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('calls onCheckedChange when toggled', () => {
    const handleChange = vi.fn()
    render(
      <Switch
        checked={false}
        onCheckedChange={handleChange}
        label='Toggle me'
        id='toggle-switch'
      />
    )
    const switchEl = screen.getByRole('switch')
    fireEvent.click(switchEl)
    expect(handleChange).toHaveBeenCalled()
  })

  it('is checked when checked prop is true', () => {
    render(
      <Switch
        checked={true}
        onCheckedChange={() => {}}
        label='Checked'
        id='checked-switch'
      />
    )
    const switchEl = screen.getByRole('switch')
    expect(switchEl).toHaveAttribute('aria-checked', 'true')
  })
})
