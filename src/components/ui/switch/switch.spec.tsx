import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './switch'
import styles from './switch.module.css'

describe('Switch', () => {
  it('renders with required props', () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} id='switch-1' />)

    const switchElement = screen.getByRole('switch')
    expect(switchElement).toBeInTheDocument()
    expect(switchElement).not.toBeChecked()
  })

  it('renders unchecked when checked is false', () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} id='switch-2' />)

    const switchElement = screen.getByRole('switch')
    expect(switchElement).not.toBeChecked()
    expect(switchElement).toHaveClass(styles.root)
    expect(switchElement).not.toHaveClass(styles.rootChecked)
  })

  it('renders checked when checked is true', () => {
    render(<Switch checked={true} onCheckedChange={vi.fn()} id='switch-3' />)

    const switchElement = screen.getByRole('switch')
    expect(switchElement).toBeChecked()
    expect(switchElement).toHaveClass(styles.root, styles.rootChecked)
  })

  it('renders label when provided', () => {
    render(
      <Switch
        checked={false}
        onCheckedChange={vi.fn()}
        id='switch-4'
        label='Test Label'
      />
    )

    const label = screen.getByText('Test Label')
    expect(label).toBeInTheDocument()
    expect(label).toHaveAttribute('for', 'switch-4')
    expect(label).toHaveClass(styles.label)
  })

  it('does not render label when not provided', () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} id='switch-5' />)

    expect(screen.queryByRole('label')).not.toBeInTheDocument()
  })

  it('calls onCheckedChange when clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Switch checked={false} onCheckedChange={handleChange} id='switch-6' />
    )

    const switchElement = screen.getByRole('switch')
    await user.click(switchElement)

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('calls onCheckedChange with correct value when toggling from checked to unchecked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Switch checked={true} onCheckedChange={handleChange} id='switch-7' />
    )

    const switchElement = screen.getByRole('switch')
    await user.click(switchElement)

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(false)
  })

  it('supports keyboard interaction', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Switch checked={false} onCheckedChange={handleChange} id='switch-8' />
    )

    const switchElement = screen.getByRole('switch')
    switchElement.focus()
    await user.keyboard('{Enter}')

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('has proper accessibility attributes', () => {
    render(
      <Switch
        checked={true}
        onCheckedChange={vi.fn()}
        id='switch-9'
        label='Test Switch'
      />
    )

    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveAttribute('aria-checked', 'true')
  })

  it('renders thumb element', () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} id='switch-10' />)

    const thumb = document.querySelector(`.${styles.thumb}`)
    expect(thumb).toBeInTheDocument()
  })

  it('applies correct wrapper styling', () => {
    render(
      <Switch
        checked={false}
        onCheckedChange={vi.fn()}
        id='switch-11'
        label='Label'
      />
    )

    const wrapper = document.querySelector(`.${styles.wrapper}`)
    expect(wrapper).toBeInTheDocument()
  })
})
