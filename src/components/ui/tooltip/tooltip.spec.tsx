import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './tooltip'
import styles from './tooltip.module.css'

describe('Tooltip', () => {
  it('renders children correctly', () => {
    render(
      <Tooltip content='Tooltip text'>
        <button type='button'>Hover me</button>
      </Tooltip>
    )

    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument()
  })

  it('renders tooltip content', () => {
    render(
      <Tooltip content='Helpful information'>
        <span>Target</span>
      </Tooltip>
    )

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveTextContent('Helpful information')
  })

  it('applies default position class (top)', () => {
    render(
      <Tooltip content='Top tooltip'>
        <span>Target</span>
      </Tooltip>
    )

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveClass(styles.tooltipContent, styles.top)
  })

  it('applies custom position class', () => {
    render(
      <Tooltip content='Bottom tooltip' position='bottom'>
        <span>Target</span>
      </Tooltip>
    )

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveClass(styles.tooltipContent, styles.bottom)
  })

  it('applies variant classes', () => {
    const { rerender } = render(
      <Tooltip content='Success' variant='success'>
        <span>Target</span>
      </Tooltip>
    )

    expect(screen.getByText('Target').parentElement).toHaveClass(styles.success)

    rerender(
      <Tooltip content='Error' variant='error'>
        <span>Target</span>
      </Tooltip>
    )

    expect(screen.getByText('Target').parentElement).toHaveClass(styles.error)

    rerender(
      <Tooltip content='Warning' variant='warning'>
        <span>Target</span>
      </Tooltip>
    )

    expect(screen.getByText('Target').parentElement).toHaveClass(styles.warning)
  })

  it('shows arrow by default', () => {
    render(
      <Tooltip content='With arrow'>
        <span>Target</span>
      </Tooltip>
    )

    const tooltip = screen.getByRole('tooltip')
    const arrow = tooltip.querySelector(`.${styles.arrow}`)
    expect(arrow).toBeInTheDocument()
  })

  it('hides arrow when showArrow is false', () => {
    render(
      <Tooltip content='No arrow' showArrow={false}>
        <span>Target</span>
      </Tooltip>
    )

    const tooltip = screen.getByRole('tooltip')
    const arrow = tooltip.querySelector(`.${styles.arrow}`)
    expect(arrow).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <Tooltip content='Custom class' className='custom-tooltip'>
        <span>Target</span>
      </Tooltip>
    )

    expect(screen.getByText('Target').parentElement).toHaveClass(
      'custom-tooltip'
    )
  })

  it('handles all position values', () => {
    const positions = ['top', 'bottom', 'left', 'right'] as const

    for (const position of positions) {
      const { unmount } = render(
        <Tooltip content={`${position} tooltip`} position={position}>
          <span>Target {position}</span>
        </Tooltip>
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveClass(styles[position])
      unmount()
    }
  })

  it('renders complex content', () => {
    render(
      <Tooltip
        content={
          <div>
            <strong>Title</strong>
            <p>Description</p>
          </div>
        }
      >
        <span>Target</span>
      </Tooltip>
    )

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.querySelector('strong')).toHaveTextContent('Title')
    expect(tooltip.querySelector('p')).toHaveTextContent('Description')
  })

  it('is accessible with role tooltip', () => {
    render(
      <Tooltip content='Accessible tooltip'>
        <button type='button'>Accessible button</button>
      </Tooltip>
    )

    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('maintains structure with nested elements', () => {
    render(
      <Tooltip content='Nested tooltip'>
        <div>
          <span>Nested</span>
          <span>Content</span>
        </div>
      </Tooltip>
    )

    expect(screen.getByText('Nested')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })
})
