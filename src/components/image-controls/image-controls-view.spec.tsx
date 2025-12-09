import { screen } from '@testing-library/react'
import { beforeEach, describe, it } from 'vitest'
import { renderWithI18n } from '@/test-utils'
import { ImageControlsView } from './image-controls-view'

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
  beforeEach(() => {
    // No setup needed
  })

  it('renders the component without crashing', () => {
    renderWithI18n(<ImageControlsView />)
    expect(screen.getByText(/Processeur/i)).toBeInTheDocument()
  })

  it('renders processor selector', () => {
    renderWithI18n(<ImageControlsView />)
    expect(screen.getByText(/Processeur/i)).toBeInTheDocument()
  })
})
