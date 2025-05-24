import { vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import {
  SourceSelectorView,
  SourceSelectorViewProps
} from './source-selector-view'

function setup(props?: Partial<SourceSelectorViewProps>) {
  const defaultProps: SourceSelectorViewProps = {
    overlayRef: { current: null },
    canvasWidth: 100,
    canvasHeight: 50,
    hoverHandle: null,
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onDoubleClick: vi.fn(),
    ...props
  }
  return render(<SourceSelectorView {...defaultProps} />)
}

describe('SourceSelectorView', () => {
  it('rend le canvas avec les bonnes dimensions', () => {
    const { container } = setup()
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeTruthy()
    expect(canvas?.getAttribute('width')).toBe('100')
    expect(canvas?.getAttribute('height')).toBe('50')
  })

  it('applique la bonne classe curseur selon hoverHandle', () => {
    const { container, rerender } = setup({ hoverHandle: 'top-left' })
    expect(container.querySelector('[class*="nwse"]')).toBeTruthy()

    rerender(
      <SourceSelectorView
        overlayRef={{ current: null }}
        canvasWidth={100}
        canvasHeight={50}
        hoverHandle='top-right'
        onMouseDown={vi.fn()}
        onMouseMove={vi.fn()}
        onMouseUp={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    )
    expect(container.querySelector('[class*="nesw"]')).toBeTruthy()

    rerender(
      <SourceSelectorView
        overlayRef={{ current: null }}
        canvasWidth={100}
        canvasHeight={50}
        hoverHandle='inside'
        onMouseDown={vi.fn()}
        onMouseMove={vi.fn()}
        onMouseUp={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    )
    expect(container.querySelector('[class*="move"]')).toBeTruthy()

    rerender(
      <SourceSelectorView
        overlayRef={{ current: null }}
        canvasWidth={100}
        canvasHeight={50}
        hoverHandle={null}
        onMouseDown={vi.fn()}
        onMouseMove={vi.fn()}
        onMouseUp={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    )
    expect(container.querySelector('[class*="crosshair"]')).toBeTruthy()
  })

  it('déclenche les callbacks souris', () => {
    const onMouseDown = vi.fn()
    const onMouseMove = vi.fn()
    const onMouseUp = vi.fn()
    const onDoubleClick = vi.fn()
    const { container } = setup({
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onDoubleClick
    })
    const overlay = container.querySelector(
      `div[class*="overlay"]`
    ) as HTMLElement

    fireEvent.mouseDown(overlay)
    fireEvent.mouseMove(overlay)
    fireEvent.mouseUp(overlay)
    fireEvent.doubleClick(overlay)

    expect(onMouseDown).toHaveBeenCalled()
    expect(onMouseMove).toHaveBeenCalled()
    expect(onMouseUp).toHaveBeenCalled()
    expect(onDoubleClick).toHaveBeenCalled()
  })
})
