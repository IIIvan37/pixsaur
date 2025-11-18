import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, it, vi } from 'vitest'
import { CPCHardware } from '@/libs/types'
import { renderWithI18n } from '@/test-utils'
import {
  ImageControlsView,
  type ImageControlsViewProps
} from './image-controls-view'

// Mock CSS modules and Slider if needed
vi.mock('../styles/image-converter.module.css', () => ({
  __esModule: true,
  default: {}
}))
vi.mock('../styles/animations.module.css', () => ({
  __esModule: true,
  default: {}
}))
vi.mock('@/components/ui/slider', () => ({
  __esModule: true,
  default: (
    props: React.ComponentProps<'input'> & {
      label: React.ReactNode
      onChange: (value: number) => void
    }
  ) => (
    <label>
      {props.label}
      <input
        type='range'
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  )
}))

describe('ImageControlsView', () => {
  let onPixelModeChange: ReturnType<typeof vi.fn>
  let onDimensionPresetChange: ReturnType<typeof vi.fn>
  let onCpcHardwareChange: ReturnType<typeof vi.fn>
  let onHorizontalSmoothingChange: ReturnType<typeof vi.fn>
  let props: ImageControlsViewProps

  beforeEach(() => {
    onPixelModeChange = vi.fn()
    onDimensionPresetChange = vi.fn()
    onCpcHardwareChange = vi.fn()
    onHorizontalSmoothingChange = vi.fn()
    props = {
      pixelMode: 0,
      onPixelModeChange,
      dimensionPreset: 'standard',
      onDimensionPresetChange,
      cpcHardware: CPCHardware.CLASSIC,
      onCpcHardwareChange,
      horizontalSmoothing: false,
      onHorizontalSmoothingChange
    }
  })

  it('renders pixel mode buttons and highlights the active one', () => {
    renderWithI18n(<ImageControlsView {...props} />)
    expect(
      screen.getByRole('button', { name: /Pixel Mode Mode 0/i })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /Pixel Mode Mode 1/i })
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByRole('button', { name: /Pixel Mode Mode 2/i })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onPixelModeChange when a mode button is clicked', async () => {
    renderWithI18n(<ImageControlsView {...props} />)
    await userEvent.click(
      screen.getByRole('button', { name: /Pixel Mode Mode 2/i })
    )
    expect(onPixelModeChange).toHaveBeenCalledWith(2)
  })

  it('renders dimension preset buttons and highlights the active one', () => {
    renderWithI18n(<ImageControlsView {...props} />)
    expect(
      screen.getByRole('button', { name: /Dimensions Standard/i })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /Dimensions Overscan/i })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onDimensionPresetChange when a dimension button is clicked', async () => {
    renderWithI18n(<ImageControlsView {...props} />)
    await userEvent.click(
      screen.getByRole('button', { name: /Dimensions Overscan/i })
    )
    expect(onDimensionPresetChange).toHaveBeenCalledWith('overscan')
  })

  it('should not show custom dimensions inputs when preset is standard', () => {
    renderWithI18n(<ImageControlsView {...props} />)

    // Width/Height inputs are only visible in custom mode
    expect(screen.queryByLabelText(/Width/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Height/)).not.toBeInTheDocument()
  })

  it('should show custom dimensions inputs when preset is custom', () => {
    const customProps = { ...props, dimensionPreset: 'custom' as const }
    renderWithI18n(<ImageControlsView {...customProps} />)

    // Width/Height labels should be visible in custom mode
    expect(screen.getByText(/Largeur/)).toBeInTheDocument()
    expect(screen.getByText(/Hauteur/)).toBeInTheDocument()
  })
})
