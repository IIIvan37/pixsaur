import { cleanup, render, screen } from '@testing-library/react'
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
  afterEach(() => {
    cleanup()
  })

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

  it('validates width step based on pixel mode - mode 0', () => {
    // Mode 0: width step = 4
    const store = createStore()
    store.set(customDimensionsAtom, { width: 320, height: 200 })
    store.set(pixelModeAtom, 0)

    render(
      <Provider store={store}>
        <CustomDimensionsInput />
      </Provider>
    )

    const sliders = screen.getAllByRole('slider')
    const widthSlider = sliders[0] // First slider is width

    expect(widthSlider?.getAttribute('aria-valuemin')).toBe('4')
    expect(widthSlider?.getAttribute('aria-valuenow')).toBe('320')
  })

  it('validates width step based on pixel mode - mode 1', () => {
    // Mode 1: width step = 8
    const store = createStore()
    store.set(customDimensionsAtom, { width: 320, height: 200 })
    store.set(pixelModeAtom, 1)

    render(
      <Provider store={store}>
        <CustomDimensionsInput />
      </Provider>
    )

    const sliders = screen.getAllByRole('slider')
    const widthSlider = sliders[0] // First slider is width
    expect(widthSlider?.getAttribute('aria-valuemin')).toBe('8')
    expect(widthSlider?.getAttribute('aria-valuenow')).toBe('320')
  })

  it('validates width step based on pixel mode - mode 2', () => {
    // Mode 2: width step = 16
    const store = createStore()
    store.set(customDimensionsAtom, { width: 320, height: 200 })
    store.set(pixelModeAtom, 2)

    render(
      <Provider store={store}>
        <CustomDimensionsInput />
      </Provider>
    )

    const sliders = screen.getAllByRole('slider')
    const widthSlider = sliders[0] // First slider is width
    expect(widthSlider?.getAttribute('aria-valuemin')).toBe('16')
    expect(widthSlider?.getAttribute('aria-valuenow')).toBe('320')
  })

  it('shows validation error immediately for invalid width', () => {
    renderWithProvider({
      customDimensions: { width: 199, height: 200 },
      pixelMode: 2
    })

    // Width 199 is invalid for mode 2 (requires multiple of 16)
    expect(
      screen.getByText(/Largeur doit être multiple de 16/)
    ).toBeInTheDocument()
  })

  it('clears validation error immediately when correcting invalid width', async () => {
    const { rerender } = renderWithProvider({
      customDimensions: { width: 199, height: 200 },
      pixelMode: 2
    })

    // Initially shows error
    expect(
      screen.getByText(/Largeur doit être multiple de 16/)
    ).toBeInTheDocument()

    // Update to valid width
    const store = createStore()
    store.set(customDimensionsAtom, { width: 192, height: 200 })
    store.set(pixelModeAtom, 2)
    rerender(
      <Provider store={store}>
        <CustomDimensionsInput />
      </Provider>
    )

    // Error should be cleared
    expect(
      screen.queryByText(/Largeur doit être multiple de 16/)
    ).not.toBeInTheDocument()
  })

  it('validates width in bytes must be even', () => {
    renderWithProvider({
      customDimensions: { width: 20, height: 200 },
      pixelMode: 2 // Mode 2: 8 pixels/byte, so 20px = 2.5 bytes
    })

    // Should show error about width in bytes being odd
    expect(
      screen.getByText(/Largeur en octets.*doit être paire/)
    ).toBeInTheDocument()
  })
})
