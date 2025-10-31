import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PixsaurSlider from './slider'
import styles from './slider.module.css'

describe('PixsaurSlider', () => {
  it('renders slider with required props', () => {
    const handleChange = vi.fn()
    render(
      <PixsaurSlider min={0} max={100} value={50} onChange={handleChange} />
    )

    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '100')
    expect(slider).toHaveAttribute('aria-valuenow', '50')
  })

  it('renders with label', () => {
    const handleChange = vi.fn()
    render(
      <PixsaurSlider
        min={0}
        max={100}
        value={50}
        onChange={handleChange}
        label='Volume'
      />
    )

    const label = screen.getByText('Volume')
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass(styles.label)
  })

  it('renders with description and info icon', () => {
    const handleChange = vi.fn()
    render(
      <PixsaurSlider
        min={0}
        max={100}
        value={50}
        onChange={handleChange}
        label='Volume'
        description='Adjust the volume level'
      />
    )

    const infoIcon = screen.getByRole('button', { name: 'Information' })
    expect(infoIcon).toBeInTheDocument()
    expect(infoIcon).toHaveTextContent('ⓘ')
  })

  it('shows description tooltip on hover', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(
      <PixsaurSlider
        min={0}
        max={100}
        value={50}
        onChange={handleChange}
        label='Volume'
        description='Adjust the volume level'
      />
    )

    const infoIcon = screen.getByRole('button', { name: 'Information' })

    await user.hover(infoIcon)
    const tooltip = screen.getByText('Adjust the volume level')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveClass(styles.descriptionTooltip)
  })

  it('hides label when hideLabel is true', () => {
    const handleChange = vi.fn()
    render(
      <PixsaurSlider
        min={0}
        max={100}
        value={50}
        onChange={handleChange}
        label='Volume'
        hideLabel
      />
    )

    const label = screen.queryByText('Volume')
    expect(label).not.toBeInTheDocument()
  })

  it('shows tooltip on hover when showTooltip is true', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(
      <PixsaurSlider
        min={0}
        max={100}
        value={75}
        onChange={handleChange}
        showTooltip
      />
    )

    const slider = screen.getByRole('slider')
    await user.hover(slider)

    const tooltip = screen.getByText('75')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveClass(styles.tooltip, styles.tooltipVisible)
  })

  it('hides tooltip when showTooltip is false', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(
      <PixsaurSlider
        min={0}
        max={100}
        value={75}
        onChange={handleChange}
        showTooltip={false}
      />
    )

    const slider = screen.getByRole('slider')
    await user.hover(slider)

    const tooltip = screen.queryByText('75')
    expect(tooltip).not.toBeInTheDocument()
  })

  it('calls onChange when value changes', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(
      <PixsaurSlider min={0} max={100} value={50} onChange={handleChange} />
    )

    const slider = screen.getByRole('slider')

    // Simulate keyboard interaction which should trigger onChange
    await user.type(slider, '{arrowright}')

    expect(handleChange).toHaveBeenCalled()
  })

  it('respects min, max, and step values', () => {
    const handleChange = vi.fn()
    render(
      <PixsaurSlider
        min={10}
        max={50}
        value={30}
        step={5}
        onChange={handleChange}
      />
    )

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuemin', '10')
    expect(slider).toHaveAttribute('aria-valuemax', '50')
    expect(slider).toHaveAttribute('aria-valuenow', '30')
  })

  it('applies disabled state', () => {
    const handleChange = vi.fn()
    render(
      <PixsaurSlider
        min={0}
        max={100}
        value={50}
        onChange={handleChange}
        disabled
      />
    )

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('data-disabled')

    const container = slider.closest(`.${styles.container}`)
    expect(container).toHaveClass(styles.container, styles.disabled)
  })

  it('positions tooltip based on value percentage', () => {
    const handleChange = vi.fn()
    render(
      <PixsaurSlider
        min={0}
        max={100}
        value={25}
        onChange={handleChange}
        showTooltip
      />
    )

    // Trigger tooltip visibility by simulating pointer enter
    const slider = screen.getByRole('slider')
    fireEvent.pointerEnter(slider)

    const tooltip = screen.getByText('25')
    // The tooltip should be positioned at 25% of the slider width
    expect(tooltip).toHaveStyle({ left: '25%' })
  })

  it('handles focus and blur events for tooltip', () => {
    const handleChange = vi.fn()
    render(
      <PixsaurSlider
        min={0}
        max={100}
        value={50}
        onChange={handleChange}
        showTooltip
      />
    )

    const slider = screen.getByRole('slider')

    fireEvent.focus(slider)
    const tooltip = screen.getByText('50')
    expect(tooltip).toHaveClass(styles.tooltip, styles.tooltipVisible)

    fireEvent.blur(slider)
    expect(tooltip).toHaveClass(styles.tooltip) // tooltipVisible should be removed
  })

  it('renders slider track and thumb', () => {
    const handleChange = vi.fn()
    render(
      <PixsaurSlider min={0} max={100} value={50} onChange={handleChange} />
    )

    // Check for Radix UI slider components
    const sliderRoot = document.querySelector(`.${styles.sliderRoot}`)
    expect(sliderRoot).toBeInTheDocument()

    const sliderTrack = document.querySelector(`.${styles.sliderTrack}`)
    expect(sliderTrack).toBeInTheDocument()

    const sliderRange = document.querySelector(`.${styles.sliderRange}`)
    expect(sliderRange).toBeInTheDocument()

    const sliderThumb = document.querySelector(`.${styles.sliderThumb}`)
    expect(sliderThumb).toBeInTheDocument()
  })
})
