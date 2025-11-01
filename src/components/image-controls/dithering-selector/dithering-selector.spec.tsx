import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, it, vi } from 'vitest'
import type { DitheringMode } from '@/libs/pixsaur-color/src'
import { renderWithI18n } from '@/utils/test-utils'
import { DitheringSelector, getDefaultIntensity } from './dithering-selector'

// Mock the jotai atom
const mockDitheringAtom = {
  mode: 'floydSteinberg' as DitheringMode,
  intensity: 0.5
}
const mockSetDitheringAtom = vi.fn()

vi.mock('jotai', async () => {
  const actual = await vi.importActual('jotai')
  return {
    ...actual,
    useAtom: vi.fn(() => [mockDitheringAtom, mockSetDitheringAtom])
  }
})

// Mock CSS modules
vi.mock('./dithering-selector.module.css', () => ({
  __esModule: true,
  default: {
    ditheringSlider: 'ditheringSlider'
  }
}))

// Mock UI components
vi.mock('@/components/ui/flex', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <div {...props}>{children}</div>
}))

vi.mock('@/components/ui/select', () => ({
  __esModule: true,
  Select: ({ children, value, onValueChange, ...props }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      {...props}
    >
      {children}
    </select>
  ),
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  )
}))

vi.mock('@/components/ui/slider', () => ({
  __esModule: true,
  default: (
    props: React.ComponentProps<'input'> & {
      label: React.ReactNode
      onChange: (value: number) => void
      disabled?: boolean
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
        disabled={props.disabled}
      />
    </label>
  )
}))

describe('getDefaultIntensity', () => {
  it('should return correct intensity for floydSteinberg', () => {
    expect(getDefaultIntensity('floydSteinberg')).toBe(0.5)
  })

  it('should return correct intensity for atkinson', () => {
    expect(getDefaultIntensity('atkinson')).toBe(0.5)
  })

  it('should return correct intensity for bayer2x2', () => {
    expect(getDefaultIntensity('bayer2x2')).toBe(0.25)
  })

  it('should return correct intensity for bayer4x4', () => {
    expect(getDefaultIntensity('bayer4x4')).toBe(0.25)
  })

  it('should return correct intensity for bayer8x8', () => {
    expect(getDefaultIntensity('bayer8x8')).toBe(0.25)
  })

  it('should return correct intensity for halftone4x4', () => {
    expect(getDefaultIntensity('halftone4x4')).toBe(0.08)
  })

  it('should return correct intensity for ylioluma1', () => {
    expect(getDefaultIntensity('ylioluma1')).toBe(0.16)
  })

  it('should return correct intensity for ylioluma2', () => {
    expect(getDefaultIntensity('ylioluma2')).toBe(1)
  })

  it('should return default intensity for unknown mode', () => {
    expect(getDefaultIntensity('unknown' as any)).toBe(0.5)
  })
})

describe('DitheringSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock to initial state
    mockDitheringAtom.mode = 'floydSteinberg'
    mockDitheringAtom.intensity = 0.5
  })

  it('should render dithering mode selector and intensity slider', () => {
    renderWithI18n(<DitheringSelector />)

    expect(screen.getByText('Mode de dithering')).toBeInTheDocument()
    expect(screen.getByText('Intensité')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('should disable intensity slider when mode is ylioluma2', () => {
    // Change mode to ylioluma2
    mockDitheringAtom.mode = 'ylioluma2'
    renderWithI18n(<DitheringSelector />)

    expect(screen.getByText('Mode de dithering')).toBeInTheDocument()
    expect(screen.getByText('Intensité')).toBeInTheDocument()
    const slider = screen.getByRole('slider')
    expect(slider).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: /réinitialiser/i })
    ).not.toBeInTheDocument()
  })

  it('should display all dithering modes in select', () => {
    renderWithI18n(<DitheringSelector />)

    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('floydSteinberg')

    // Check that all options are present
    expect(
      screen.getByRole('option', { name: 'Floyd–Steinberg' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Bayer 2x2' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Bayer 4x4' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'bayer 8x8' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Ylioluma 1' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Ylioluma 2' })
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Atkinson' })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Halftone 4x4' })
    ).toBeInTheDocument()
  })

  it('should display current intensity value in slider', () => {
    renderWithI18n(<DitheringSelector />)

    const slider = screen.getByRole('slider')
    expect(slider).toHaveValue('50') // 0.5 * 100 = 50
  })

  it('should update dithering mode and set default intensity when mode changes', async () => {
    const user = userEvent.setup()
    renderWithI18n(<DitheringSelector />)

    const select = screen.getByRole('combobox')

    // Change to bayer2x2 mode
    await user.selectOptions(select, 'bayer2x2')

    expect(mockSetDitheringAtom).toHaveBeenCalledWith({
      ...mockDitheringAtom,
      mode: 'bayer2x2',
      intensity: 0.25
    })
  })

  it('should update intensity when slider changes', () => {
    renderWithI18n(<DitheringSelector />)

    const slider = screen.getByRole('slider')

    // Change intensity to 75 by directly setting the value
    fireEvent.change(slider, { target: { value: '75' } })

    expect(mockSetDitheringAtom).toHaveBeenCalledWith({
      ...mockDitheringAtom,
      intensity: 0.75
    })
  })

  it('should reset intensity to default when reset button is clicked', () => {
    renderWithI18n(<DitheringSelector />)

    const resetButton = screen.getByRole('button', { name: /réinitialiser/i })

    fireEvent.click(resetButton)

    expect(mockSetDitheringAtom).toHaveBeenCalledWith({
      ...mockDitheringAtom,
      intensity: 0.5 // Default for floydSteinberg
    })
  })

  it('should set correct default intensity for each mode when changed', async () => {
    const user = userEvent.setup()

    // Test each mode change
    const testCases: Array<[DitheringMode, number]> = [
      ['atkinson', 0.5],
      ['bayer2x2', 0.25],
      ['bayer4x4', 0.25],
      ['bayer8x8', 0.25],
      ['halftone4x4', 0.08],
      ['ylioluma1', 0.16],
      ['ylioluma2', 1]
    ]

    for (const [mode, expectedIntensity] of testCases) {
      vi.clearAllMocks()
      const { container } = renderWithI18n(<DitheringSelector />)

      const select = container.querySelector('select')!
      await user.selectOptions(select, mode)

      expect(mockSetDitheringAtom).toHaveBeenCalledWith({
        ...mockDitheringAtom,
        mode,
        intensity: expectedIntensity
      })
    }
  })
})
