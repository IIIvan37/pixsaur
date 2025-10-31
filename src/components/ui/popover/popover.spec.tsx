import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PixsaurPopover from './popover'
import styles from './popover.module.css'

describe('PixsaurPopover', () => {
  it('renders popover content when open', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={true}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
      >
        <p>Popover content</p>
      </PixsaurPopover>
    )

    expect(screen.getByText('Popover content')).toBeInTheDocument()
  })

  it('does not render popover content when closed', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={false}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
      >
        <p>Popover content</p>
      </PixsaurPopover>
    )

    expect(screen.queryByText('Popover content')).not.toBeInTheDocument()
  })

  it('renders trigger button', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={false}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Open Popover</button>}
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    const triggerButton = screen.getByRole('button', { name: 'Open Popover' })
    expect(triggerButton).toBeInTheDocument()
  })

  it('calls onOpenChange when trigger is clicked', async () => {
    const user = userEvent.setup()
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={false}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Open Popover</button>}
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    const triggerButton = screen.getByRole('button', { name: 'Open Popover' })
    await user.click(triggerButton)

    expect(handleOpenChange).toHaveBeenCalledWith(true)
  })

  it('applies default variant styling', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={true}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
        variant='default'
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    const popoverContent = document.querySelector(`.${styles.popover}`)
    expect(popoverContent).toBeInTheDocument()
  })

  it('applies unstyled variant', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={true}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
        variant='unstyled'
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    const popoverContent = document.querySelector(`.${styles.unstyled}`)
    expect(popoverContent).toBeInTheDocument()

    // Should not have default styling
    const defaultPopover = document.querySelector(`.${styles.popover}`)
    expect(defaultPopover).not.toBeInTheDocument()
  })

  it('renders arrow for default variant', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={true}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
        variant='default'
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    const arrow = document.querySelector(`.${styles.arrow}`)
    expect(arrow).toBeInTheDocument()
  })

  it('does not render arrow for unstyled variant', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={true}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
        variant='unstyled'
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    const arrow = document.querySelector(`.${styles.arrow}`)
    expect(arrow).not.toBeInTheDocument()
  })

  it('applies positioning props', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={true}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
        side='top'
        align='start'
        sideOffset={16}
        collisionPadding={12}
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    // Radix UI handles positioning internally, we just verify the component renders
    const popoverContent = document.querySelector('[data-side="top"]')
    expect(popoverContent).toBeInTheDocument()
  })

  it('handles complex content', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={true}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
      >
        <div>
          <h3>Title</h3>
          <p>Description</p>
          <button type='button'>Action</button>
        </div>
      </PixsaurPopover>
    )

    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('uses default positioning values', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={true}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    // Default values: side="right", align="center", sideOffset=8, collisionPadding=8
    const popoverContent = document.querySelector('[data-side="right"]')
    expect(popoverContent).toBeInTheDocument()
  })

  it('maintains controlled state', () => {
    const handleOpenChange = vi.fn()
    const { rerender } = render(
      <PixsaurPopover
        open={true}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    expect(screen.getByText('Content')).toBeInTheDocument()

    // Change open state externally
    rerender(
      <PixsaurPopover
        open={false}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Trigger</button>}
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('handles custom trigger element', () => {
    const handleOpenChange = vi.fn()
    render(
      <PixsaurPopover
        open={false}
        onOpenChange={handleOpenChange}
        trigger={<button type='button'>Custom Trigger</button>}
      >
        <p>Content</p>
      </PixsaurPopover>
    )

    const trigger = screen.getByRole('button', { name: 'Custom Trigger' })
    expect(trigger).toBeInTheDocument()
  })
})
