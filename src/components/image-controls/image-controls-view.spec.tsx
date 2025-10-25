import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, it, vi } from 'vitest'
import { CPCHardware } from '@/libs/types'
import { renderWithI18n } from '@/utils/test-utils'
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
  let onCpcHardwareChange: ReturnType<typeof vi.fn>
  let props: ImageControlsViewProps

  beforeEach(() => {
    onModeChange = vi.fn()
    onCpcHardwareChange = vi.fn()
    props = {
      mode: '0',
      onModeChange,
      cpcHardware: CPCHardware.CLASSIC,
      onCpcHardwareChange
    }
  })

  it('renders mode buttons and highlights the active one', () => {
    renderWithI18n(<ImageControlsView {...props} />)
    expect(screen.getByRole('button', { name: /^Mode 0$/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: /^Mode 1$/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('button', { name: /^Mode 2$/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('calls onModeChange when a mode button is clicked', async () => {
    renderWithI18n(<ImageControlsView {...props} />)
    await userEvent.click(screen.getByRole('button', { name: /Mode 2$/i }))
    expect(onModeChange).toHaveBeenCalledWith('2')
  })

  it('should show target dimensions panel for mode 0', () => {
    renderWithI18n(<ImageControlsView {...props} mode='0' />)

    // Target dimensions panel is always visible in new architecture
    expect(screen.queryByLabelText(/Width/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Height/)).toBeInTheDocument()
  })

  it('should show target dimensions panel for mode 1', () => {
    renderWithI18n(<ImageControlsView {...props} mode='1' />)

    // Target dimensions panel is always visible in new architecture
    expect(screen.queryByLabelText(/Width/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Height/)).toBeInTheDocument()
  })

  it('should show target dimensions panel for mode 0 with presets', () => {
    renderWithI18n(<ImageControlsView {...props} mode='0' />)

    // Should find width/height inputs from TargetDimensions
    expect(screen.getByLabelText(/Width/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Height/)).toBeInTheDocument()
  })

  it('should show target dimensions panel for mode 1', () => {
    renderWithI18n(<ImageControlsView {...props} mode='1' />)

    expect(screen.getByLabelText(/Width/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Height/)).toBeInTheDocument()
  })

  it('should show target dimensions panel for mode 2', () => {
    renderWithI18n(<ImageControlsView {...props} mode='2' />)

    expect(screen.getByLabelText(/Width/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Height/)).toBeInTheDocument()
  })
})
