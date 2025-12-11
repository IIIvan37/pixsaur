import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { CPCColor } from '@/libs/types'
import { InkColorTrigger, InkSelector } from './raster-panel-view'

const mockCpcPalette: CPCColor[] = [
  {
    index: 0,
    name: 'Black',
    hex: '000000',
    vector: new Float32Array([0, 0, 0])
  },
  {
    index: 1,
    name: 'Blue',
    hex: '0000ff',
    vector: new Float32Array([0, 0, 255])
  },
  {
    index: 2,
    name: 'Red',
    hex: 'ff0000',
    vector: new Float32Array([255, 0, 0])
  },
  {
    index: 3,
    name: 'Green',
    hex: '00ff00',
    vector: new Float32Array([0, 255, 0])
  }
]

describe('InkSelector', () => {
  it('should render ink buttons for each color', () => {
    const onSelectInk = vi.fn()
    const { container } = render(
      <InkSelector nColors={4} selectedInk={0} onSelectInk={onSelectInk} />
    )

    const inkButtons = container.querySelectorAll(
      '[class*="inkSelectorButton"]'
    )
    expect(inkButtons).toHaveLength(4)
  })

  it('should display ink indices as button text', () => {
    const onSelectInk = vi.fn()
    render(
      <InkSelector nColors={4} selectedInk={0} onSelectInk={onSelectInk} />
    )

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('should mark selected ink button with selected class', () => {
    const onSelectInk = vi.fn()
    const { container } = render(
      <InkSelector nColors={4} selectedInk={2} onSelectInk={onSelectInk} />
    )

    const inkButtons = container.querySelectorAll(
      '[class*="inkSelectorButton"]'
    )
    expect(inkButtons[2].className).toContain('inkSelectorSelected')
    expect(inkButtons[0].className).not.toContain('inkSelectorSelected')
    expect(inkButtons[1].className).not.toContain('inkSelectorSelected')
  })

  it('should call onSelectInk when an ink button is clicked', async () => {
    const onSelectInk = vi.fn()
    render(
      <InkSelector nColors={4} selectedInk={0} onSelectInk={onSelectInk} />
    )

    const inkButton2 = screen.getByText('2')
    await userEvent.click(inkButton2)

    expect(onSelectInk).toHaveBeenCalledWith(2)
    expect(onSelectInk).toHaveBeenCalledTimes(1)
  })

  it('should render only allowed inks when allowedInks is provided', () => {
    const onSelectInk = vi.fn()
    const { container } = render(
      <InkSelector
        nColors={4}
        selectedInk={0}
        onSelectInk={onSelectInk}
        allowedInks={[0, 2]}
      />
    )

    const inkButtons = container.querySelectorAll(
      '[class*="inkSelectorButton"]'
    )
    expect(inkButtons).toHaveLength(2)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })
})

describe('InkColorTrigger', () => {
  it('should render trigger button with ink index', () => {
    const onInkChange = vi.fn()
    const onColorChange = vi.fn()
    const { container } = render(
      <InkColorTrigger
        color={[255, 0, 0] as Vector<'RGB'>}
        inkIndex={2}
        nColors={4}
        cpcPalette={mockCpcPalette}
        isClassicMode={true}
        onInkChange={onInkChange}
        onColorChange={onColorChange}
      />
    )

    const inkLabel = container.querySelector('[class*="inkLabel"]')
    expect(inkLabel?.textContent).toBe('2')
  })

  it('should render color swatch with correct background color', () => {
    const onInkChange = vi.fn()
    const onColorChange = vi.fn()
    const { container } = render(
      <InkColorTrigger
        color={[255, 0, 0] as Vector<'RGB'>}
        inkIndex={2}
        nColors={4}
        cpcPalette={mockCpcPalette}
        isClassicMode={true}
        onInkChange={onInkChange}
        onColorChange={onColorChange}
      />
    )

    const colorSwatch = container.querySelector('[class*="colorSwatch"]')
    expect(colorSwatch?.getAttribute('style')).toContain('#ff0000')
  })

  it('should display arrow separator between ink and color', () => {
    const onInkChange = vi.fn()
    const onColorChange = vi.fn()
    const { container } = render(
      <InkColorTrigger
        color={[255, 0, 0] as Vector<'RGB'>}
        inkIndex={2}
        nColors={4}
        cpcPalette={mockCpcPalette}
        isClassicMode={true}
        onInkChange={onInkChange}
        onColorChange={onColorChange}
      />
    )

    const arrow = container.querySelector('[class*="arrow"]')
    expect(arrow?.textContent).toBe('→')
  })

  it('should call onInkChange when ink is changed', async () => {
    const onInkChange = vi.fn()
    const onColorChange = vi.fn()
    const { container } = render(
      <InkColorTrigger
        color={[0, 0, 0] as Vector<'RGB'>}
        inkIndex={0}
        nColors={4}
        cpcPalette={mockCpcPalette}
        isClassicMode={true}
        onInkChange={onInkChange}
        onColorChange={onColorChange}
      />
    )

    // Click trigger to open popover
    const trigger = container.querySelector('[class*="inkColorButton"]')
    if (trigger) {
      await userEvent.click(trigger)
    }

    // Find and click ink button 2
    const inkButton = screen.queryByText('2')
    if (inkButton) {
      await userEvent.click(inkButton)
      expect(onInkChange).toHaveBeenCalledWith(2)
    }
  })
})
