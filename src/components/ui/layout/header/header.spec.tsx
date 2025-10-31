import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Header } from './header'
import styles from './header.module.css'

describe('Header', () => {
  it('renders with title only', () => {
    render(<Header title='Test Title' />)

    const title = screen.getByRole('heading', { level: 1 })
    expect(title).toHaveTextContent('Test Title')
    expect(title).toHaveClass(styles.sectionTitle)
  })

  it('renders with action only', () => {
    const handleAction = vi.fn()
    render(<Header action={handleAction} actionLabel='Click me' />)

    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).toHaveTextContent('Click me')
    expect(button).toHaveClass(styles.headerButton)
  })

  it('renders with title and action', () => {
    const handleAction = vi.fn()
    render(
      <Header title='Test Title' action={handleAction} actionLabel='Action' />
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Test Title'
    )
    expect(screen.getByRole('button', { name: 'Action' })).toHaveTextContent(
      'Action'
    )
  })

  it('renders with icon', () => {
    const handleAction = vi.fn()
    render(
      <Header action={handleAction} actionLabel='Action' icon='PlusIcon' />
    )

    const button = screen.getByRole('button', { name: 'Action' })
    const icon = button.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('calls action when button is clicked', async () => {
    const user = userEvent.setup()
    const handleAction = vi.fn()

    render(<Header action={handleAction} actionLabel='Click me' />)

    const button = screen.getByRole('button', { name: 'Click me' })
    await user.click(button)

    expect(handleAction).toHaveBeenCalledTimes(1)
  })

  it('renders disabled button when disabled', () => {
    const handleAction = vi.fn()
    render(
      <Header
        action={handleAction}
        actionLabel='Disabled action'
        disabled={true}
      />
    )

    const button = screen.getByRole('button', { name: 'Disabled action' })
    expect(button).toBeDisabled()
  })

  it('applies correct CSS classes', () => {
    const handleAction = vi.fn()
    const { container } = render(
      <Header title='Title' action={handleAction} actionLabel='Action' />
    )

    const header = container.firstChild as HTMLElement
    expect(header).toHaveClass(styles.sectionHeader)

    const title = screen.getByRole('heading', { level: 1 })
    expect(title).toHaveClass(styles.sectionTitle)

    const button = screen.getByRole('button')
    expect(button).toHaveClass(styles.headerButton)
  })

  it('renders complex title content', () => {
    render(
      <Header
        title={
          <span>
            Complex <strong>Title</strong>
          </span>
        }
      />
    )

    const title = screen.getByRole('heading', { level: 1 })
    expect(title).toHaveTextContent('Complex Title')
    expect(title.querySelector('strong')).toBeInTheDocument()
  })

  it('renders complex action label', () => {
    const handleAction = vi.fn()
    render(
      <Header
        action={handleAction}
        actionLabel={
          <span>
            Complex <em>Label</em>
          </span>
        }
      />
    )

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('Complex Label')
    expect(button.querySelector('em')).toBeInTheDocument()
  })

  it('renders empty header', () => {
    const { container } = render(<Header />)

    const header = container.firstChild as HTMLElement
    expect(header).toHaveClass(styles.sectionHeader)
    expect(header).toBeEmptyDOMElement()
  })
})
