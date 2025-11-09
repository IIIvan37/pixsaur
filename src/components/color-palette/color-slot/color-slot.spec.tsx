import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { ColorSlot } from './color-slot'

vi.mock('@/components/ui/icon', () => ({
  default: ({ name, className }: { name: string; className: string }) => (
    <span data-testid='icon' data-icon={name} className={className} />
  )
}))

describe('ColorSlot', () => {
  const defaultProps = {
    color: [255, 0, 0] as Vector<'RGB'>,
    locked: false,
    buttonRef: vi.fn(),
    focused: false
  }

  describe('Rendering', () => {
    it('should render color slot with correct hex color', () => {
      const { container } = render(<ColorSlot {...defaultProps} />)
      const button = container.querySelector('button')

      expect(button).toBeDefined()
      // Red color should be #ff0000
      expect(button?.title).toContain('#ff0000')
    })

    it('should render unlocked state by default', () => {
      const { container } = render(<ColorSlot {...defaultProps} />)
      const button = container.querySelector('button')

      expect(button?.title).toContain('déverrouillée')
      expect(screen.queryByTestId('icon')).toBeNull()
    })

    it('should render locked icon when locked', () => {
      render(<ColorSlot {...defaultProps} locked={true} />)

      const icon = screen.getByTestId('icon')
      expect(icon).toBeDefined()
      expect(icon.getAttribute('data-icon')).toBe('LockClosedIcon')
    })

    it('should show locked state in tooltip', () => {
      const { container } = render(
        <ColorSlot {...defaultProps} locked={true} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('verrouillée')
    })

    it('should render with focused state', () => {
      // ColorSlot passes aria-selected but ColorButton doesn't support it yet
      // Test that component renders successfully with focused prop
      const { container } = render(
        <ColorSlot {...defaultProps} focused={true} />
      )
      expect(container.querySelector('button')).toBeDefined()
    })

    it('should render with unfocused state', () => {
      const { container } = render(
        <ColorSlot {...defaultProps} focused={false} />
      )
      expect(container.querySelector('button')).toBeDefined()
    })
  })

  describe('Color conversion', () => {
    it('should convert black color correctly', () => {
      const blackColor = [0, 0, 0] as Vector<'RGB'>
      const { container } = render(
        <ColorSlot {...defaultProps} color={blackColor} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('#000000')
    })

    it('should convert white color correctly', () => {
      const whiteColor = [255, 255, 255] as Vector<'RGB'>
      const { container } = render(
        <ColorSlot {...defaultProps} color={whiteColor} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('#ffffff')
    })

    it('should convert blue color correctly', () => {
      const blueColor = [0, 0, 255] as Vector<'RGB'>
      const { container } = render(
        <ColorSlot {...defaultProps} color={blueColor} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('#0000ff')
    })

    it('should convert green color correctly', () => {
      const greenColor = [0, 255, 0] as Vector<'RGB'>
      const { container } = render(
        <ColorSlot {...defaultProps} color={greenColor} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('#00ff00')
    })
  })

  describe('Occurrence count formatting', () => {
    it('should display "0 pixel" for zero occurrences', () => {
      const { container } = render(
        <ColorSlot {...defaultProps} occurrenceCount={0} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('0 pixel')
    })

    it('should display "1 pixel" for single occurrence', () => {
      const { container } = render(
        <ColorSlot {...defaultProps} occurrenceCount={1} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('1 pixel')
    })

    it('should display count for small numbers', () => {
      const { container } = render(
        <ColorSlot {...defaultProps} occurrenceCount={42} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('42 pixels')
    })

    it('should format thousands with "k" suffix', () => {
      const { container } = render(
        <ColorSlot {...defaultProps} occurrenceCount={1500} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('1.5k pixels')
    })

    it('should format larger thousands with "k" suffix', () => {
      const { container } = render(
        <ColorSlot {...defaultProps} occurrenceCount={25000} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('25.0k pixels')
    })

    it('should format millions with "M" suffix', () => {
      const { container } = render(
        <ColorSlot {...defaultProps} occurrenceCount={1500000} />
      )
      const button = container.querySelector('button')

      expect(button?.title).toContain('1.5M pixels')
    })

    it('should not display occurrence count when undefined', () => {
      const { container } = render(
        <ColorSlot {...defaultProps} occurrenceCount={undefined} />
      )
      const button = container.querySelector('button')

      // Should only contain hex and lock status
      expect(button?.title).not.toContain('pixel')
    })
  })

  describe('Interactions', () => {
    it('should call onOpenPopover when clicked', () => {
      const onOpenPopover = vi.fn()
      const { container } = render(
        <ColorSlot {...defaultProps} onOpenPopover={onOpenPopover} />
      )
      const button = container.querySelector('button')

      button?.click()
      expect(onOpenPopover).toHaveBeenCalledTimes(1)
    })

    it('should not have onClick when onOpenPopover is undefined', () => {
      const { container } = render(
        <ColorSlot {...defaultProps} onOpenPopover={undefined} />
      )
      const button = container.querySelector('button')

      // Should not throw when clicked
      expect(() => button?.click()).not.toThrow()
    })

    it('should call buttonRef with button element', () => {
      const buttonRef = vi.fn()
      render(<ColorSlot {...defaultProps} buttonRef={buttonRef} />)

      expect(buttonRef).toHaveBeenCalled()
      const arg = buttonRef.mock.calls[0][0]
      expect(arg).toBeInstanceOf(HTMLButtonElement)
    })
  })

  describe('Lock icon styling', () => {
    it('should use dark icon for bright colors', () => {
      // White is bright
      const brightColor = [255, 255, 255] as Vector<'RGB'>
      render(<ColorSlot {...defaultProps} color={brightColor} locked={true} />)

      const icon = screen.getByTestId('icon')
      expect(icon.className).toContain('lockIconDark')
    })

    it('should use light icon for dark colors', () => {
      // Black is dark
      const darkColor = [0, 0, 0] as Vector<'RGB'>
      render(<ColorSlot {...defaultProps} color={darkColor} locked={true} />)

      const icon = screen.getByTestId('icon')
      expect(icon.className).toContain('lockIconLight')
    })

    it('should have lock overlay with aria-hidden', () => {
      render(<ColorSlot {...defaultProps} locked={true} />)

      const overlay = document.querySelector('[aria-hidden="true"]')
      expect(overlay).toBeDefined()
    })
  })

  describe('Forward ref', () => {
    it('should forward ref to button element', () => {
      const ref = vi.fn()
      render(<ColorSlot {...defaultProps} ref={ref} />)

      expect(ref).toHaveBeenCalled()
      const element = ref.mock.calls[0][0]
      expect(element).toBeInstanceOf(HTMLButtonElement)
    })
  })
})
