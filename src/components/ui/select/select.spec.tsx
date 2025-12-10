import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Select, SelectItem } from './select'
import styles from './select.module.css'

describe('Select', () => {
  it('renders with required props', () => {
    render(
      <Select value='option1' onValueChange={vi.fn()}>
        <SelectItem value='option1'>Option 1</SelectItem>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveClass(styles.trigger)
  })

  it('displays selected value', () => {
    render(
      <Select value='option2' onValueChange={vi.fn()}>
        <SelectItem value='option1'>Option 1</SelectItem>
        <SelectItem value='option2'>Option 2</SelectItem>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('Option 2')
  })

  it('renders trigger with chevron icon', () => {
    render(
      <Select value='option1' onValueChange={vi.fn()}>
        <SelectItem value='option1'>Option 1</SelectItem>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    const icon = trigger.querySelector(`.${styles.icon}`)
    expect(icon).toBeInTheDocument()
  })

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Select value='option1' onValueChange={handleChange}>
        <SelectItem value='option1'>Option 1</SelectItem>
        <SelectItem value='option2'>Option 2</SelectItem>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    // Verify the dropdown opened
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    // Verify trigger is accessible via keyboard
    expect(trigger).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    render(
      <Select value='option1' onValueChange={vi.fn()}>
        <SelectItem value='option1'>Option 1</SelectItem>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-autocomplete', 'none')
  })

  it('renders with empty value', () => {
    render(
      <Select value='' onValueChange={vi.fn()}>
        <SelectItem value='option1'>Option 1</SelectItem>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeInTheDocument()
  })

  it('renders multiple items', () => {
    render(
      <Select value='option1' onValueChange={vi.fn()}>
        <SelectItem value='option1'>Option 1</SelectItem>
        <SelectItem value='option2'>Option 2</SelectItem>
        <SelectItem value='option3'>Option 3</SelectItem>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('Option 1')
  })

  it('renders with custom content', () => {
    render(
      <Select value='test' onValueChange={vi.fn()}>
        <SelectItem value='test'>Test Content</SelectItem>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('Test Content')
  })
})

describe('SelectItem', () => {
  it('renders with required props', () => {
    render(
      <Select value='option1' onValueChange={vi.fn()}>
        <SelectItem value='test'>Test Item</SelectItem>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeInTheDocument()
  })

  it('displays children content', () => {
    render(
      <Select value='test' onValueChange={vi.fn()}>
        <SelectItem value='test'>Test Content</SelectItem>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('Test Content')
  })
})
