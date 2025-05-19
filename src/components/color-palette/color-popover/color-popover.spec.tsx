import { render, screen } from '@testing-library/react'

import { ColorPopover } from './color-popover'
import type { CPCColor } from '@/libs/types'
import type { PaletteSlot } from '@/app/store/palette/types'

describe('ColorPopover', () => {
  const fullPalette: CPCColor[] = [
    {
      index: 0,
      name: 'Rouge',
      hex: 'ff0000',
      vector: new Float32Array([1, 2, 3])
    },
    {
      index: 1,
      name: 'Vert',
      hex: '00ff00',
      vector: new Float32Array([4, 5, 6])
    },
    {
      index: 2,
      name: 'Bleu',
      hex: '0000ff',
      vector: new Float32Array([7, 8, 9])
    }
  ]

  const baseSlots: PaletteSlot[] = [
    { color: new Float32Array([1, 2, 3]), locked: false }, // Rouge
    { color: null, locked: false }, // Empty
    { color: new Float32Array([4, 5, 6]), locked: true } // Vert
  ]

  it('disables color options already used in other slots', () => {
    render(
      <ColorPopover
        fullPalette={fullPalette}
        slots={baseSlots}
        slotIdx={1} // The empty slot
        focusedColorIdx={0}
        onColorSelect={() => {}}
        onKeyDown={() => {}}
        getPopoverStyle={() => ({})}
        onClose={() => {}}
      />
    )

    // Rouge and Vert should be disabled, Bleu should not
    const rougeBtn = screen.getByRole('option', { name: /Rouge/i })
    const vertBtn = screen.getByRole('option', { name: /Vert/i })
    const bleuBtn = screen.getByRole('option', { name: /Bleu/i })

    expect(rougeBtn).toBeDisabled()
    expect(vertBtn).toBeDisabled()
    expect(bleuBtn).not.toBeDisabled()
  })

  it('does not disable color if used in the current slot', () => {
    // Slot 0 is filled with Rouge, so Rouge should not be disabled for slotIdx 0
    render(
      <ColorPopover
        fullPalette={fullPalette}
        slots={baseSlots}
        slotIdx={0}
        focusedColorIdx={0}
        onColorSelect={() => {}}
        onKeyDown={() => {}}
        getPopoverStyle={() => ({})}
        onClose={() => {}}
      />
    )

    const rougeBtn = screen.getByRole('option', { name: /Rouge/i })
    expect(rougeBtn).not.toBeDisabled()
  })
})
