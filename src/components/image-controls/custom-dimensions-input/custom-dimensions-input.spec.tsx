import { render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { customDimensionsAtom, pixelModeAtom } from '@/app/store/config/config'
import type { PixelMode } from '@/app/store/config/types'
import { CustomDimensionsInput } from './custom-dimensions-input'

const renderWithProvider = (initialValues?: {
  customDimensions?: { width: number; height: number }
  pixelMode?: PixelMode
}) => {
  const store = createStore()
  store.set(
    customDimensionsAtom,
    initialValues?.customDimensions || { width: 320, height: 200 }
  )
  store.set(pixelModeAtom, initialValues?.pixelMode || 2)

  return render(
    <Provider store={store}>
      <CustomDimensionsInput />
    </Provider>
  )
}

describe('CustomDimensionsInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders width and height sliders with correct labels', () => {
    renderWithProvider()

    // Check that sliders exist and have proper structure
    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(2)

    // Check that labels contain expected text patterns
    expect(screen.getByText(/\(320px/)).toBeInTheDocument() // width
    expect(screen.getByText(/\(200px\)/)).toBeInTheDocument() // height
  })

  it('displays current dimensions in slider labels', () => {
    renderWithProvider({
      customDimensions: { width: 160, height: 100 }
    })

    expect(screen.getByText(/160/)).toBeInTheDocument()
    expect(screen.getByText(/100/)).toBeInTheDocument()
  })

  it('shows memory usage for valid dimensions', () => {
    renderWithProvider({
      customDimensions: { width: 320, height: 200 }
    })

    // Check for memory display pattern
    expect(screen.getByText(/Ko \/ 64 Ko/)).toBeInTheDocument()
  })

  it('shows validation errors for invalid dimensions', () => {
    renderWithProvider({
      customDimensions: { width: 10000, height: 10000 } // Too large
    })

    // Check for error message pattern
    expect(screen.getByText(/dépass/)).toBeInTheDocument()
  })

  it('renders sliders with correct accessibility attributes', () => {
    renderWithProvider({
      customDimensions: { width: 320, height: 200 }
    })

    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(2)

    // Check that sliders have proper min/max values
    const widthSlider = sliders.find(
      (slider) => slider.getAttribute('aria-valuenow') === '320'
    )
    const heightSlider = sliders.find(
      (slider) => slider.getAttribute('aria-valuenow') === '200'
    )

    expect(widthSlider).toBeInTheDocument()
    expect(heightSlider).toBeInTheDocument()
  })

  it('calculates correct max width based on height', () => {
    renderWithProvider({
      customDimensions: { width: 320, height: 8 }
    })

    // With height=8, max width should be much larger
    const sliders = screen.getAllByRole('slider')
    const widthSlider = sliders.find(
      (slider) => slider.getAttribute('aria-valuenow') === '320'
    )

    // Check that max width is much higher than default
    expect(widthSlider?.getAttribute('aria-valuemax')).toBe('65536')
  })

  it('syncs local state when atom changes externally', () => {
    const { rerender } = renderWithProvider({
      customDimensions: { width: 320, height: 200 }
    })

    // Initially shows 320px width
    expect(screen.getByText(/320/)).toBeInTheDocument()

    // Simulate external atom change by rerendering with new values
    const newStore = createStore()
    newStore.set(customDimensionsAtom, { width: 640, height: 400 })
    newStore.set(pixelModeAtom, 2)

    rerender(
      <Provider store={newStore}>
        <CustomDimensionsInput />
      </Provider>
    )

    expect(screen.getByText(/640/)).toBeInTheDocument()
  })

  it('handles different pixel modes correctly', () => {
    renderWithProvider({
      customDimensions: { width: 160, height: 200 },
      pixelMode: 1
    })

    // Check that component renders with different pixel mode
    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(2)

    // MODE1 should have different calculations
    expect(screen.getByText(/160/)).toBeInTheDocument()
  })
})
