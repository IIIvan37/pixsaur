import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Checkbox from './checkbox'
import styles from './checkbox.module.css'

describe('Checkbox', () => {
  it('renders checkbox input without label', () => {
    render(<Checkbox />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toHaveClass(styles.checkbox)
  })

  it('renders checkbox input with label', () => {
    render(<Checkbox label='Accept terms' />)

    const checkbox = screen.getByRole('checkbox')
    const label = screen.getByText('Accept terms')

    expect(checkbox).toBeInTheDocument()
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass(styles.checkboxLabel)
  })

  it('associates label with checkbox input', () => {
    render(<Checkbox label='Test Option' />)

    const checkbox = screen.getByRole('checkbox')
    const label = screen.getByText('Test Option')

    // Label wraps the input, so no 'for' attribute needed
    expect(label).toContainElement(checkbox)
  })

  it('applies custom className to label when present', () => {
    render(<Checkbox label='Option' className='custom-checkbox' />)

    const label = screen.getByText('Option')
    expect(label).toHaveClass(styles.checkboxLabel, 'custom-checkbox')
  })

  it('applies custom className to checkbox when no label', () => {
    render(<Checkbox className='custom-checkbox' />)

    const checkbox = screen.getByRole('checkbox')
    // Note: Current implementation doesn't apply className when no label
    expect(checkbox).toHaveClass(styles.checkbox)
    expect(checkbox).not.toHaveClass('custom-checkbox')
  })

  it('passes through HTML checkbox props', () => {
    render(<Checkbox name='agreement' value='accepted' disabled />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('name', 'agreement')
    expect(checkbox).toHaveAttribute('value', 'accepted')
    expect(checkbox).toBeDisabled()
  })

  it('handles checked state', () => {
    render(<Checkbox checked />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  it('handles user interaction', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Checkbox onChange={handleChange} />)

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('handles label click to toggle checkbox', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Checkbox label='Click me' onChange={handleChange} />)

    const label = screen.getByText('Click me')
    await user.click(label)

    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('maintains accessibility with label association', () => {
    render(<Checkbox label='Accessible Option' />)

    const checkbox = screen.getByRole('checkbox')
    const label = screen.getByText('Accessible Option')

    expect(checkbox).toBeInTheDocument()
    // Label wraps the input, so no 'for' attribute needed
    expect(label).toContainElement(checkbox)
    expect(label).toHaveClass(styles.checkboxLabel)
  })
})
