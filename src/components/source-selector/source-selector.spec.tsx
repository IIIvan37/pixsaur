import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SourceSelectorView } from './source-selector-view'
import styles from './source-selector.module.css'

describe('SourceSelectorView', () => {
  const baseProps = {
    rect: { x: 10, y: 20, width: 30, height: 40 },
    dragging: false,
    resizeHandle: null,
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onDoubleClick: vi.fn()
  }

  it('renders four handles', () => {
    const { container } = render(<SourceSelectorView {...baseProps} />)
    const handles = container.querySelectorAll('[data-handle]')
    expect(handles.length).toBe(4)
  })

  it('calls onMouseDown when mouse is pressed', () => {
    const { container } = render(<SourceSelectorView {...baseProps} />)
    fireEvent.mouseDown(container.firstChild as Element)
    expect(baseProps.onMouseDown).toHaveBeenCalled()
  })

  it('calls onMouseMove when mouse is moved', () => {
    const { container } = render(<SourceSelectorView {...baseProps} />)
    fireEvent.mouseMove(container.firstChild as Element)
    expect(baseProps.onMouseMove).toHaveBeenCalled()
  })

  it('calls onMouseUp when mouse is released', () => {
    const { container } = render(<SourceSelectorView {...baseProps} />)
    fireEvent.mouseUp(container.firstChild as Element)
    expect(baseProps.onMouseUp).toHaveBeenCalled()
  })

  it('calls onDoubleClick when double clicked', () => {
    const { container } = render(<SourceSelectorView {...baseProps} />)
    fireEvent.doubleClick(container.firstChild as Element)
    expect(baseProps.onDoubleClick).toHaveBeenCalled()
  })

  it('renders the selection rectangle with correct class', () => {
    const { getByTestId } = render(<SourceSelectorView {...baseProps} />)
    const rect = getByTestId('selection-rect')
    expect(rect).toHaveClass(styles['selection-rect'])
    expect(rect).not.toHaveClass(styles['selection-rect--active'])
  })

  it('shows selection background when dragging', () => {
    const { getByTestId } = render(
      <SourceSelectorView {...baseProps} dragging={true} />
    )
    const rect = getByTestId('selection-rect')
    expect(rect).toHaveClass(
      styles['selection-rect'],
      styles['selection-rect--active']
    )
  })

  it('shows selection background when resizing', () => {
    const { getByTestId } = render(
      <SourceSelectorView {...baseProps} resizeHandle='top-left' />
    )
    const rect = getByTestId('selection-rect')
    expect(rect).toHaveClass(
      styles['selection-rect'],
      styles['selection-rect--active']
    )
  })
})
