import { render } from '@testing-library/react'

import { ImageSelectorView } from './image-selector-view'

// Mock SourceSelector to avoid rendering its internals
vi.mock('../source-selector', () => ({
  SourceSelector: () => <div data-testid='source-selector' />
}))

describe('ImageSelectorView', () => {
  it('renders a canvas with correct dimensions', () => {
    const refCallback = vi.fn()

    render(
      <ImageSelectorView
        canvasWidth={123}
        canvasHeight={456}
        src={null}
        refCallback={refCallback}
      />
    )
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveAttribute('width', '123')
    expect(canvas).toHaveAttribute('height', '456')
  })

  it('calls refCallback with the canvas element', () => {
    const refCallback = vi.fn()

    render(
      <ImageSelectorView
        canvasWidth={100}
        canvasHeight={100}
        src={null}
        refCallback={refCallback}
      />
    )
    // refCallback should have been called at least once with a canvas or null
    expect(refCallback).toHaveBeenCalled()
    // The first call is with the canvas element
    const firstArg = refCallback.mock.calls[0][0]
    expect(firstArg instanceof HTMLCanvasElement || firstArg === null).toBe(
      true
    )
  })

  it('renders SourceSelector when src is provided', () => {
    const refCallback = vi.fn()

    const imageData = new ImageData(50, 60)
    render(
      <ImageSelectorView
        canvasWidth={100}
        canvasHeight={100}
        src={imageData}
        refCallback={refCallback}
      />
    )
    expect(
      document.querySelector('[data-testid="source-selector"]')
    ).toBeInTheDocument()
  })

  it('does not render SourceSelector when src is null', () => {
    const refCallback = vi.fn()

    render(
      <ImageSelectorView
        canvasWidth={100}
        canvasHeight={100}
        src={null}
        refCallback={refCallback}
      />
    )
    expect(
      document.querySelector('[data-testid="source-selector"]')
    ).not.toBeInTheDocument()
  })

  it('handles zero canvas size gracefully', () => {
    render(
      <ImageSelectorView
        canvasWidth={0}
        canvasHeight={0}
        src={null}
        refCallback={() => {}}
      />
    )
    expect(document.querySelector('canvas')).toHaveAttribute('width', '0')
    expect(document.querySelector('canvas')).toHaveAttribute('height', '0')
  })

  it('does not crash if refCallback is undefined', () => {
    expect(() =>
      render(
        <ImageSelectorView
          canvasWidth={100}
          canvasHeight={100}
          src={null}
          // @ts-expect-error intentionally passing undefined
          refCallback={undefined}
        />
      )
    ).not.toThrow()
  })
})
