import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import Button from './button'
import { describe, it, expect, jest } from 'bun:test'

describe('Button Component', () => {
  it('renders the button with the correct children', () => {
    render(<Button>Click Me</Button>)
    expect(screen.getByText('Click Me')).toBeInTheDocument()
  })

  it('calls the onClick handler when clicked', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click Me</Button>)
    fireEvent.click(screen.getByText('Click Me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders with the correct type attribute', () => {
    render(<Button type='submit'>Submit</Button>)
    const button = screen.getByText('Submit')
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('applies additional class names', () => {
    const { container } = render(
      <Button className='custom-class'>Custom Class</Button>
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('renders with ARIA attributes', () => {
    render(
      <Button aria-label='Test Button' aria-pressed={true}>
        ARIA Button
      </Button>
    )
    const button = screen.getByText('ARIA Button')
    expect(button).toHaveAttribute('aria-label', 'Test Button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})
