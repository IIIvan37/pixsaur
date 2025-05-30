import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, vi, beforeEach } from 'vitest'
import { ColorPaletteView, ColorPaletteViewProps } from './color-palette-view'

import { userEvent } from '@testing-library/user-event'
import { vectorToHex } from '@/palettes/cpc-palette'

// Mock CSS modules and Icon to avoid style/import issues in tests
vi.mock('./color-palette.module.css', () => ({
  __esModule: true,
  default: {}
}))
vi.mock('@/styles/animations.module.css', () => ({
  __esModule: true,
  default: {}
}))
vi.mock('@/components/ui/icon')

// Mock palette data for tests (French names)
const mockPalette = [
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
  { index: 2, name: 'Bleu', hex: '0000ff', vector: new Float32Array([7, 8, 9]) }
]

const hex_rouge = vectorToHex(mockPalette[0].vector)
const hex_vert = vectorToHex(mockPalette[1].vector)

// Mock slots for palette view
const filledSlot = { color: new Float32Array([1, 2, 3]), locked: false }
const lockedSlot = { color: new Float32Array([4, 5, 6]), locked: true }
const emptySlot = { color: null, locked: false }

let onToggleLock: ReturnType<typeof vi.fn>
let onSetColor: ReturnType<typeof vi.fn>
let props: ColorPaletteViewProps

beforeEach(() => {
  onToggleLock = vi.fn()
  onSetColor = vi.fn()
  props = {
    slots: [filledSlot, emptySlot, lockedSlot],
    onToggleLock,
    onSetColor,
    fullPalette: mockPalette
  }
})

describe('ColorPaletteView', () => {
  it('renders the correct number of slots', () => {
    render(<ColorPaletteView {...props} />)
    expect(screen.getAllByRole('button').length).toBe(3)
  })

  it('renders filled slots with color and lock state', () => {
    render(<ColorPaletteView {...props} />)
    // Unlocked filled slot
    expect(
      screen.getByRole('button', { name: `#${hex_rouge} déverrouillée` })
    ).toBeInTheDocument()
    // Locked filled slot
    expect(
      screen.getByRole('button', {
        name: new RegExp(`#${hex_vert} verrouillée`, 'i')
      })
    ).toBeInTheDocument()
    // Lock icon is rendered for locked slot
    expect(screen.getByTestId('LockClosedIcon')).toBeInTheDocument()
  })

  it('renders empty slots with plus icon', () => {
    render(<ColorPaletteView {...props} />)
    expect(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    ).toBeInTheDocument()
    expect(screen.getByTestId('PlusIcon')).toBeInTheDocument()
  })

  it('opens popover when empty slot is clicked', async () => {
    render(<ColorPaletteView {...props} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )
    expect(
      await screen.findByRole('listbox', { name: /Options de couleur/i })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('option').length).toBe(3)
  })

  it('opens popover when empty slot is clicked', () => {
    render(<ColorPaletteView {...props} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )
    expect(
      screen.getByRole('listbox', { name: /Options de couleur/i })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('option').length).toBe(3)
  })

  it('calls onSetColor and closes popover when a color is selected', async () => {
    render(<ColorPaletteView {...props} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )
    const bleuBtn = await screen.findByRole('option', { name: /Bleu/i })
    fireEvent.click(bleuBtn)
    expect(onSetColor).toHaveBeenCalledWith({ index: 1, color: mockPalette[2] })
    // Popover should close
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    )
  })

  it('disables color options already used in other slots', () => {
    render(<ColorPaletteView {...props} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )
    // Rouge et Vert sont utilisés, Bleu ne l'est pas
    const rougeBtn = screen.getByRole('option', { name: /Rouge/i })
    const vertBtn = screen.getByRole('option', { name: /Vert/i })
    const bleuBtn = screen.getByRole('option', { name: /Bleu/i })
    expect(rougeBtn).toBeDisabled()
    expect(vertBtn).toBeDisabled()
    expect(bleuBtn).not.toBeDisabled()
  })

  it('has correct ARIA attributes', () => {
    render(<ColorPaletteView {...props} />)
    // Region for palette
    expect(
      screen.getByRole('region', { name: /Palette de couleurs/i })
    ).toBeInTheDocument()
    // Popover listbox
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )
    expect(
      screen.getByRole('listbox', { name: /Options de couleur/i })
    ).toBeInTheDocument()
  })

  it('closes popover when clicking outside', async () => {
    render(<ColorPaletteView {...props} />)

    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )

    expect(screen.getByRole('listbox')).toBeInTheDocument()

    userEvent.click(document.body) // ← parfois nécessaire pour déclencher onBlur

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })
})
