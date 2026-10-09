import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore } from 'jotai'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { renderWithProviders } from '@/test-utils'
import { ZoomStage } from './zoom-stage'

/** A blank 16 x 8 image: the stage only cares about its size. */
const IMAGE: Sheet = {
  width: 16,
  height: 8,
  data: new Uint8ClampedArray(16 * 8 * 4)
}

function renderStage() {
  renderWithProviders(<ZoomStage image={IMAGE} label='Planche convertie' />, {
    store: createStore()
  })
  return screen.getByRole('img', { name: 'Planche convertie' })
}

/** happy-dom lays nothing out: the stage is given the size it would have. */
function layOutStage(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
}

/** The 2D context the stage drew the image with. */
function contextOf(canvas: HTMLElement) {
  const getContext = vi.mocked(HTMLCanvasElement.prototype.getContext)
  const at = getContext.mock.contexts.lastIndexOf(canvas)
  return getContext.mock.results[at].value as CanvasRenderingContext2D
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ZoomStage', () => {
  it('fits the image to the stage by the largest whole factor', () => {
    layOutStage(100, 50)

    expect(renderStage()).toHaveProperty('width', 96)
  })

  it('zooms in to the next step', async () => {
    const canvas = renderStage()

    await userEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))

    expect(canvas).toHaveProperty('width', 32)
  })

  it('zooms in from the keyboard', async () => {
    const canvas = renderStage()

    screen.getByRole('region', { name: 'Image zoomable' }).focus()
    await userEvent.keyboard('+')

    expect(canvas).toHaveProperty('width', 32)
  })

  it('zooms in when the wheel turns up with Ctrl held', () => {
    const canvas = renderStage()

    // happy-dom's WheelEvent drops `ctrlKey` from its init: set it by hand.
    const wheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true })
    Object.defineProperty(wheel, 'ctrlKey', { value: true })
    fireEvent(screen.getByRole('region', { name: 'Image zoomable' }), wheel)

    expect(canvas).toHaveProperty('width', 32)
  })

  it('goes back to the fitted size', async () => {
    const canvas = renderStage()

    await userEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ajuster' }))

    expect(canvas).toHaveProperty('width', 16)
  })

  it('copies the image without smoothing its pixels', () => {
    const canvas = renderStage()

    expect(contextOf(canvas).imageSmoothingEnabled).toBe(false)
  })
})
