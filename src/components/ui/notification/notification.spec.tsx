import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Notification } from './notification'

// Mock the Icon component
vi.mock('@/components/ui/icon')

describe('Notification', () => {
  it('should render notification when open is true', () => {
    render(
      <Notification
        message='Test notification'
        type='success'
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.getByText('Test notification')).toBeInTheDocument()
  })

  it('should not render notification when open is false', () => {
    render(
      <Notification
        message='Test notification'
        type='success'
        open={false}
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.queryByText('Test notification')).not.toBeInTheDocument()
  })

  it('should call onOpenChange after autoCloseDuration', async () => {
    const onOpenChange = vi.fn()

    render(
      <Notification
        message='Auto close message'
        type='success'
        open={true}
        onOpenChange={onOpenChange}
        autoCloseDuration={100}
      />
    )

    expect(onOpenChange).not.toHaveBeenCalled()

    await waitFor(
      () => {
        expect(onOpenChange).toHaveBeenCalledWith(false)
      },
      { timeout: 200 }
    )
  })

  it('should use default duration of 3000ms when not provided', async () => {
    const onOpenChange = vi.fn()

    render(
      <Notification
        message='No auto close'
        type='success'
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    await waitFor(
      () => {
        expect(onOpenChange).toHaveBeenCalledWith(false)
      },
      { timeout: 3500 }
    )
  })

  it('should cleanup timeout on unmount', async () => {
    const onOpenChange = vi.fn()

    const { unmount } = render(
      <Notification
        message='Cleanup test'
        type='success'
        open={true}
        onOpenChange={onOpenChange}
        autoCloseDuration={100}
      />
    )

    unmount()

    // Wait longer than the timeout
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Should not call onOpenChange after unmount
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('should not auto-close when open is false', () => {
    const onOpenChange = vi.fn()

    render(
      <Notification
        message='Not open'
        type='success'
        open={false}
        onOpenChange={onOpenChange}
        autoCloseDuration={100}
      />
    )

    // Should not set up any timers when not open
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('should render different types correctly', () => {
    const types: Array<'success' | 'error' | 'info'> = [
      'success',
      'error',
      'info'
    ]

    types.forEach((type) => {
      const { unmount } = render(
        <Notification
          message={`${type} message`}
          type={type}
          open={true}
          onOpenChange={vi.fn()}
        />
      )

      expect(screen.getByText(`${type} message`)).toBeInTheDocument()
      unmount()
    })
  })
})
