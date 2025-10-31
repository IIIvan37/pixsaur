import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PixsaurDialog from './dialog'
import styles from './dialog.module.css'

describe('PixsaurDialog', () => {
  it('renders dialog content when open', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Test Dialog'
      >
        <p>Dialog content</p>
      </PixsaurDialog>
    )

    expect(screen.getByText('Test Dialog')).toBeInTheDocument()
    expect(screen.getByText('Dialog content')).toBeInTheDocument()
  })

  it('does not render dialog content when closed', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={false}
        onOpenChange={handleOpenChange}
        title='Test Dialog'
      >
        <p>Dialog content</p>
      </PixsaurDialog>
    )

    expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Dialog content')).not.toBeInTheDocument()
  })

  it('renders title with correct styling', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Test Title'
      >
        <p>Content</p>
      </PixsaurDialog>
    )

    const title = screen.getByText('Test Title')
    expect(title).toHaveClass(styles.title)
    expect(title.tagName).toBe('H2') // Radix UI renders title as h2
  })

  it('renders description when provided', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Test Dialog'
        description='Test description'
      >
        <p>Content</p>
      </PixsaurDialog>
    )

    const description = screen.getByText('Test description')
    expect(description).toHaveClass(styles.description)
  })

  it('does not render description when not provided', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Test Dialog'
      >
        <p>Content</p>
      </PixsaurDialog>
    )

    expect(screen.queryByText('Test description')).not.toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Test Dialog'
        footer={<button type='button'>Close</button>}
      >
        <p>Content</p>
      </PixsaurDialog>
    )

    const footer = screen.getByText('Close').closest(`.${styles.footer}`)
    expect(footer).toBeInTheDocument()
  })

  it('renders close button with correct aria-label', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Test Dialog'
      >
        <p>Content</p>
      </PixsaurDialog>
    )

    const closeButton = screen.getByRole('button', { name: 'Close' })
    expect(closeButton).toHaveClass(styles.closeButton)
    expect(closeButton).toHaveTextContent('×')
  })

  it('calls onOpenChange when close button is clicked', async () => {
    const user = userEvent.setup()
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Test Dialog'
      >
        <p>Content</p>
      </PixsaurDialog>
    )

    const closeButton = screen.getByRole('button', { name: 'Close' })
    await user.click(closeButton)

    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders trigger button when provided', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={false}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Open Dialog</button>}
        title='Test Dialog'
      >
        <p>Content</p>
      </PixsaurDialog>
    )

    const triggerButton = screen.getByRole('button', { name: 'Open Dialog' })
    expect(triggerButton).toBeInTheDocument()
  })

  it('calls onOpenChange when trigger is clicked', async () => {
    const user = userEvent.setup()
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={false}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Open Dialog</button>}
        title='Test Dialog'
      >
        <p>Content</p>
      </PixsaurDialog>
    )

    const triggerButton = screen.getByRole('button', { name: 'Open Dialog' })
    await user.click(triggerButton)

    expect(handleOpenChange).toHaveBeenCalledWith(true)
  })

  it('renders overlay and content with correct styling', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Test Dialog'
      >
        <p>Content</p>
      </PixsaurDialog>
    )

    // Check for Radix UI dialog elements
    const overlay = document.querySelector(`.${styles.overlay}`)
    expect(overlay).toBeInTheDocument()

    const content = document.querySelector(`.${styles.content}`)
    expect(content).toBeInTheDocument()
  })

  it('renders body content in correct container', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Test Dialog'
      >
        <div data-testid='body-content'>Body content</div>
      </PixsaurDialog>
    )

    const bodyContent = screen.getByTestId('body-content')
    const bodyContainer = bodyContent.closest(`.${styles.body}`)
    expect(bodyContainer).toBeInTheDocument()
  })

  it('handles complex content structure', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Complex Dialog'
        description='A dialog with complex content'
        footer={
          <div>
            <button type='button'>Cancel</button>
            <button type='button'>Confirm</button>
          </div>
        }
      >
        <form>
          <label htmlFor='input'>Input field:</label>
          <input id='input' type='text' />
        </form>
      </PixsaurDialog>
    )

    expect(screen.getByText('Complex Dialog')).toBeInTheDocument()
    expect(
      screen.getByText('A dialog with complex content')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Input field:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('maintains accessibility with proper ARIA attributes', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurDialog
        open={true}
        onOpenChange={handleOpenChange}
        title='Accessible Dialog'
        description='This dialog is accessible'
      >
        <p>Content</p>
      </PixsaurDialog>
    )

    // Radix UI should handle most accessibility attributes
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toBeInTheDocument()

    const title = screen.getByText('Accessible Dialog')
    expect(title).toHaveAttribute('id')

    const description = screen.getByText('This dialog is accessible')
    expect(description).toHaveAttribute('id')
  })
})
