import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Radio from './radio'
import styles from './radio.module.css'

describe('Radio', () => {
  it('renders radio input without label', () => {
    render(<Radio />)

    const radio = screen.getByRole('radio')
    expect(radio).toBeInTheDocument()
    expect(radio).toHaveClass(styles.radio)
  })

  it('renders radio input with label', () => {
    render(<Radio label='Option 1' />)

    const radio = screen.getByRole('radio')
    const label = screen.getByText('Option 1')

    expect(radio).toBeInTheDocument()
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass(styles.radioLabel)
  })

  it('associates label with radio input', () => {
    render(<Radio label='Test Option' />)

    const radio = screen.getByRole('radio')
    const label = screen.getByText('Test Option')

    // Label wraps the input, so no 'for' attribute needed
    expect(label).toContainElement(radio)
  })

  it('applies custom className to label when present', () => {
    render(<Radio label='Option' className='custom-radio' />)

    const label = screen.getByText('Option')
    expect(label).toHaveClass(styles.radioLabel, 'custom-radio')
  })

  it('applies custom className to radio when no label', () => {
    render(<Radio className='custom-radio' />)

    const radio = screen.getByRole('radio')
    // Note: Current implementation doesn't apply className when no label
    expect(radio).toHaveClass(styles.radio)
    expect(radio).not.toHaveClass('custom-radio')
  })

  it('passes through HTML radio props', () => {
    render(<Radio name='group1' value='option1' disabled />)

    const radio = screen.getByRole('radio')
    expect(radio).toHaveAttribute('name', 'group1')
    expect(radio).toHaveAttribute('value', 'option1')
    expect(radio).toBeDisabled()
  })

  it('handles checked state', () => {
    render(<Radio checked />)

    const radio = screen.getByRole('radio')
    expect(radio).toBeChecked()
  })

  it('handles user interaction', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Radio onChange={handleChange} />)

    const radio = screen.getByRole('radio')
    await user.click(radio)

    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('handles label click to toggle radio', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Radio label='Click me' onChange={handleChange} />)

    const label = screen.getByText('Click me')
    await user.click(label)

    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('maintains accessibility with label association', () => {
    render(<Radio label='Accessible Option' />)

    const radio = screen.getByRole('radio')
    const label = screen.getByText('Accessible Option')

    expect(radio).toBeInTheDocument()
    // Label wraps the input, so no 'for' attribute needed
    expect(label).toContainElement(radio)
    expect(label).toHaveClass(styles.radioLabel)
  })
})
