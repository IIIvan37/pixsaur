import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, it, vi } from 'vitest'
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
  let onRasterEnabledChange: ReturnType<typeof vi.fn>
  let props: ImageControlsViewProps

  beforeEach(() => {
    onRasterEnabledChange = vi.fn()
    props = {
      rasterEnabled: false,
      onRasterEnabledChange
    }
  })

  it('renders the component without crashing', () => {
    renderWithI18n(<ImageControlsView {...props} />)
    expect(screen.getByText(/Palette/i)).toBeInTheDocument()
  })

  it('renders raster/dithering selector', () => {
    renderWithI18n(<ImageControlsView {...props} />)
    expect(screen.getByText(/Traitement d'image/i)).toBeInTheDocument()
  })

  it('calls onRasterEnabledChange when raster is toggled', async () => {
    renderWithI18n(<ImageControlsView {...props} />)
    const rasterSwitch = screen.getByRole('switch', { name: /Raster/i })
    await userEvent.click(rasterSwitch)
    expect(onRasterEnabledChange).toHaveBeenCalledWith(true)
  })
})
