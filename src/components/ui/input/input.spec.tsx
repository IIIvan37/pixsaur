import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import Input from './input'
import styles from './input.module.css'

describe('Input', () => {
  it('renders input without label', () => {
    render(<Input placeholder='Enter text' />)

    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass(styles.input)
  })

  it('renders input with label', () => {
    render(<Input label='Username' placeholder='Enter username' />)

    const input = screen.getByPlaceholderText('Enter username')
    const label = screen.getByText('Username')

    expect(input).toBeInTheDocument()
    expect(label).toBeInTheDocument()
    expect(label).toHaveAttribute('for', 'username')
    expect(input).toHaveAttribute('id', 'username')
  })

  it('renders error message', () => {
    render(<Input label='Email' error='Invalid email format' />)

    const error = screen.getByText('Invalid email format')
    expect(error).toBeInTheDocument()
    expect(error).toHaveClass(styles.error)
  })

  it('applies error styling to input', () => {
    render(<Input label='Email' error='Invalid email' />)

    const input = screen.getByLabelText('Email')
    expect(input).toHaveClass(styles.input, styles.inputError)
  })

  it('applies custom className', () => {
    render(<Input className='custom-input' placeholder='Test' />)

    const input = screen.getByPlaceholderText('Test')
    expect(input).toHaveClass(styles.input, 'custom-input')
  })

  it('passes through HTML input props', () => {
    render(<Input type='password' disabled placeholder='Password' />)

    const input = screen.getByPlaceholderText('Password')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toBeDisabled()
  })

  it('handles user input', async () => {
    const user = userEvent.setup()
    render(<Input placeholder='Type here' />)

    const input = screen.getByPlaceholderText('Type here')
    await user.type(input, 'Hello World')

    expect(input).toHaveValue('Hello World')
  })

  it('generates id from label when no id provided', () => {
    render(<Input label='First Name' />)

    const input = screen.getByLabelText('First Name')
    expect(input).toHaveAttribute('id', 'first-name')
  })

  it('renders input group structure with label and error', () => {
    const { container } = render(
      <Input label='Test Field' error='Test error' placeholder='Test' />
    )

    const inputGroup = container.firstChild
    expect(inputGroup).toHaveClass(styles.inputGroup)

    const label = inputGroup?.firstChild
    expect(label).toHaveClass(styles.label)

    const input = inputGroup?.childNodes[1]
    expect(input).toHaveClass(styles.input, styles.inputError)

    const error = inputGroup?.childNodes[2]
    expect(error).toHaveClass(styles.error)
  })
})
