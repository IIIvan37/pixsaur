import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, vi, beforeEach } from 'vitest'
import {
  ImageControlsView,
  ImageControlsViewProps
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
      label: string
      onChange: (value: number) => void
    }
  ) => (
    <input
      type='range'
      min={props.min}
      max={props.max}
      step={props.step}
      value={props.value}
      aria-label={props.label}
      onChange={(e) => props.onChange(Number(e.target.value))}
    />
  )
}))

describe('ImageControlsView', () => {
  let onModeChange: ReturnType<typeof vi.fn>
  let onDitheringChange: ReturnType<typeof vi.fn>
  let onColorSpaceChange: ReturnType<typeof vi.fn>
  let props: ImageControlsViewProps

  beforeEach(() => {
    onModeChange = vi.fn()
    onDitheringChange = vi.fn()
    onColorSpaceChange = vi.fn()
    props = {
      mode: '0',
      onModeChange,
      dithering: { intensity: 0.5 },
      onDitheringChange,
      colorSpace: 'RGB',
      onColorSpaceChange
    }
  })

  it('renders mode buttons and highlights the active one', () => {
    render(<ImageControlsView {...props} />)
    expect(screen.getByRole('button', { name: /Mode 0/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: /Mode 1/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('button', { name: /Mode 2/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('calls onModeChange when a mode button is clicked', async () => {
    render(<ImageControlsView {...props} />)
    await userEvent.click(screen.getByRole('button', { name: /Mode 2/i }))
    expect(onModeChange).toHaveBeenCalledWith('2')
  })

  it('renders the dithering slider with correct value', () => {
    render(<ImageControlsView {...props} />)
    const slider = screen.getByRole('slider', { name: /Tramage/i })
    expect(slider).toHaveValue('0.5')
  })

  it('calls onDitheringChange when slider is changed', async () => {
    render(<ImageControlsView {...props} />)
    const slider = screen.getByRole('slider', { name: /Tramage/i })
    fireEvent.change(slider, { target: { value: 0.7 } })
    expect(onDitheringChange).toHaveBeenCalledWith({ intensity: 0.7 })
  })

  it('renders color space buttons and highlights the active one', () => {
    render(<ImageControlsView {...props} />)
    expect(
      screen.getByRole('button', { name: /ColorSpace RGB/i })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /ColorSpace XYZ/i })
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByRole('button', { name: /ColorSpace Lab/i })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onColorSpaceChange when a color space button is clicked', async () => {
    render(<ImageControlsView {...props} />)
    await userEvent.click(
      screen.getByRole('button', { name: /ColorSpace Lab/i })
    )
    expect(onColorSpaceChange).toHaveBeenCalledWith('Lab')
  })
})
