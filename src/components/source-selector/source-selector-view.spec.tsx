import { fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithI18n } from '@/test-utils'
import styles from './source-selector.module.css'
import { SourceSelectorView } from './source-selector-view'
import type { Handle } from './utils'

describe('SourceSelectorView', () => {
  const baseProps = {
    rect: { x: 10, y: 20, width: 30, height: 40 },
    dragging: false,
    resizeHandle: null as Handle,
    hoveredHandle: null as Handle,
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onMouseLeave: vi.fn(),
    onDoubleClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders four resize handles', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )
      const handles = container.querySelectorAll('[data-handle]')
      expect(handles.length).toBe(4)
    })

    it('renders handles with correct names', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )

      const handleNames = [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right'
      ]
      handleNames.forEach((name) => {
        const handle = container.querySelector(`[data-handle="${name}"]`)
        expect(handle).toBeInTheDocument()
      })
    })

    it('renders the selection rectangle', () => {
      const { getByTestId } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )
      const rect = getByTestId('selection-rect')
      expect(rect).toBeInTheDocument()
    })

    it('applies correct positioning styles to selection rect', () => {
      const { getByTestId } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )
      const rect = getByTestId('selection-rect')

      expect(rect).toHaveStyle({
        top: '20%',
        left: '10%',
        width: '30%',
        height: '40%'
      })
    })
  })

  describe('mouse interactions', () => {
    it('calls onMouseDown when mouse is pressed', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )
      fireEvent.mouseDown(container.firstChild as Element)
      expect(baseProps.onMouseDown).toHaveBeenCalled()
    })

    it('calls onMouseMove when mouse is moved', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )
      fireEvent.mouseMove(container.firstChild as Element)
      expect(baseProps.onMouseMove).toHaveBeenCalled()
    })

    it('calls onMouseUp when mouse is released', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )
      fireEvent.mouseUp(container.firstChild as Element)
      expect(baseProps.onMouseUp).toHaveBeenCalled()
    })

    it('calls onMouseLeave when mouse leaves', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )
      fireEvent.mouseLeave(container.firstChild as Element)
      expect(baseProps.onMouseLeave).toHaveBeenCalled()
    })

    it('calls onDoubleClick when double clicked', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )
      fireEvent.doubleClick(container.firstChild as Element)
      expect(baseProps.onDoubleClick).toHaveBeenCalled()
    })
  })

  describe('visual states', () => {
    it('renders the selection rectangle with correct class', () => {
      const { getByTestId } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )
      const rect = getByTestId('selection-rect')
      expect(rect).toHaveClass(styles['selection-rect'])
      expect(rect).not.toHaveClass(styles['selection-rect--active'])
    })

    it('shows active state when dragging', () => {
      const { getByTestId } = renderWithI18n(
        <SourceSelectorView {...baseProps} dragging={true} />
      )
      const rect = getByTestId('selection-rect')
      expect(rect).toHaveClass(styles['selection-rect'])
      expect(rect).toHaveClass(styles['selection-rect--active'])
    })

    it('shows active state when resizing', () => {
      const { getByTestId } = renderWithI18n(
        <SourceSelectorView {...baseProps} resizeHandle='top-left' />
      )
      const rect = getByTestId('selection-rect')
      expect(rect).toHaveClass(styles['selection-rect--active'])
    })

    it('shows active state when bottom-right resize handle is active', () => {
      const { getByTestId } = renderWithI18n(
        <SourceSelectorView {...baseProps} resizeHandle='bottom-right' />
      )
      const rect = getByTestId('selection-rect')
      expect(rect).toHaveClass(styles['selection-rect--active'])
    })
  })

  describe('cursor behavior', () => {
    it('applies crosshair cursor when dragging (no handle active)', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} dragging={true} />
      )
      const section = container.querySelector('section')
      // Default cursor is crosshair, dragging doesn't change cursor unless handle is set
      expect(section).toHaveStyle({ cursor: 'crosshair' })
    })

    it('applies nwse-resize cursor for top-left handle', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} resizeHandle='top-left' />
      )
      const section = container.querySelector('section')
      expect(section).toHaveStyle({ cursor: 'nwse-resize' })
    })

    it('applies nesw-resize cursor for top-right handle', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} resizeHandle='top-right' />
      )
      const section = container.querySelector('section')
      expect(section).toHaveStyle({ cursor: 'nesw-resize' })
    })

    it('applies nesw-resize cursor for bottom-left handle', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} resizeHandle='bottom-left' />
      )
      const section = container.querySelector('section')
      expect(section).toHaveStyle({ cursor: 'nesw-resize' })
    })

    it('applies nwse-resize cursor for bottom-right handle', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} resizeHandle='bottom-right' />
      )
      const section = container.querySelector('section')
      expect(section).toHaveStyle({ cursor: 'nwse-resize' })
    })

    it('applies crosshair cursor when not dragging or resizing', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} />
      )
      const section = container.querySelector('section')
      expect(section).toHaveStyle({ cursor: 'crosshair' })
    })
  })

  describe('hovered handle cursor', () => {
    it('shows nwse-resize cursor when hovering top-left', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} hoveredHandle='top-left' />
      )
      const section = container.querySelector('section')
      expect(section).toHaveStyle({ cursor: 'nwse-resize' })
    })

    it('shows nesw-resize cursor when hovering top-right', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} hoveredHandle='top-right' />
      )
      const section = container.querySelector('section')
      expect(section).toHaveStyle({ cursor: 'nesw-resize' })
    })
  })

  describe('dimensions label', () => {
    it('renders dimensions when logicalWidth and logicalHeight are provided', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView
          {...baseProps}
          logicalWidth={320}
          logicalHeight={200}
        />
      )

      // With rect width=30% of 320 = 96, height=40% of 200 = 80
      expect(container.textContent).toContain('96')
      expect(container.textContent).toContain('80')
    })

    it('does not render dimensions label when logicalWidth is undefined', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} logicalHeight={200} />
      )

      // Should not contain dimension format
      expect(container.textContent).not.toContain('×')
    })

    it('does not render dimensions label when logicalHeight is undefined', () => {
      const { container } = renderWithI18n(
        <SourceSelectorView {...baseProps} logicalWidth={320} />
      )

      expect(container.textContent).not.toContain('×')
    })
  })

  describe('edge cases', () => {
    it('handles rect with zero dimensions', () => {
      const { getByTestId } = renderWithI18n(
        <SourceSelectorView
          {...baseProps}
          rect={{ x: 0, y: 0, width: 0, height: 0 }}
        />
      )
      const rect = getByTestId('selection-rect')
      expect(rect).toHaveStyle({
        top: '0%',
        left: '0%',
        width: '0%',
        height: '0%'
      })
    })

    it('handles rect at 100% dimensions', () => {
      const { getByTestId } = renderWithI18n(
        <SourceSelectorView
          {...baseProps}
          rect={{ x: 0, y: 0, width: 100, height: 100 }}
        />
      )
      const rect = getByTestId('selection-rect')
      expect(rect).toHaveStyle({
        width: '100%',
        height: '100%'
      })
    })
  })
})
