import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import { userEvent } from '@testing-library/user-event'
import { createStore, Provider } from 'jotai'
import { beforeEach, describe, it, vi } from 'vitest'
import { cpcHardwareAtom } from '@/app/store/config/config'
import { CPCHardware } from '@/libs/types'
import {
  ColorPaletteView,
  type ColorPaletteViewProps
} from './color-palette-view'

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
  {
    index: 2,
    name: 'Bleu',
    hex: '0000ff',
    vector: new Float32Array([7, 8, 9])
  }
]

const hex_rouge = '010203' // vectorToHex([1, 2, 3])
const hex_vert = '040506' // vectorToHex([4, 5, 6])

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
      await screen.findByRole('group', { name: /Options de couleur/i })
    ).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('button')
        .filter(
          (btn) =>
            btn.title?.includes('Rouge') ||
            btn.title?.includes('Vert') ||
            btn.title?.includes('Bleu')
        ).length
    ).toBe(3)
  })

  it('opens popover when empty slot is clicked', () => {
    render(<ColorPaletteView {...props} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )
    expect(
      screen.getByRole('group', { name: /Options de couleur/i })
    ).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('button')
        .filter(
          (btn) =>
            btn.title?.includes('Rouge') ||
            btn.title?.includes('Vert') ||
            btn.title?.includes('Bleu')
        ).length
    ).toBe(3)
  })

  it('calls onSetColor and closes popover when a color is selected', async () => {
    render(<ColorPaletteView {...props} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )
    const bleuBtn = await screen.findByRole('button', { name: /Bleu/i })
    fireEvent.click(bleuBtn)
    expect(onSetColor).toHaveBeenCalledWith({
      index: 1,
      color: mockPalette[2]
    })
    // Popover should close
    await waitFor(() =>
      expect(screen.queryByRole('group')).not.toBeInTheDocument()
    )
  })

  it('allows selecting color options even if already used in other slots', () => {
    render(<ColorPaletteView {...props} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )
    // Toutes les couleurs peuvent être sélectionnées, même si déjà utilisées
    const rougeBtn = screen.getByRole('button', {
      name: /Rouge/i
    })
    const vertBtn = screen.getByRole('button', { name: /Vert/i })
    const bleuBtn = screen.getByRole('button', { name: /^Bleu$/i })
    expect(rougeBtn).not.toBeDisabled()
    expect(vertBtn).not.toBeDisabled()
    expect(bleuBtn).not.toBeDisabled()
  })

  it('has correct ARIA attributes', () => {
    render(<ColorPaletteView {...props} />)
    // Region for palette
    expect(
      screen.getByRole('region', { name: /Palette de couleurs/i })
    ).toBeInTheDocument()
    // Popover group
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )
    expect(
      screen.getByRole('group', { name: /Options de couleur/i })
    ).toBeInTheDocument()
  })

  it('closes popover when clicking outside', async () => {
    render(<ColorPaletteView {...props} />)

    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter une couleur/i })
    )

    expect(screen.getByRole('group')).toBeInTheDocument()

    userEvent.click(document.body) // ← parfois nécessaire pour déclencher onBlur

    await waitFor(() => {
      expect(screen.queryByRole('group')).not.toBeInTheDocument()
    })
  })

  describe('CPC Plus mode', () => {
    it('renders ColorPickerPopup for CPC Plus mode when slot has color', () => {
      const store = createStore()
      store.set(cpcHardwareAtom, CPCHardware.PLUS)

      render(
        <Provider store={store}>
          <ColorPaletteView {...props} />
        </Provider>
      )

      // Click on filled slot to open popover
      fireEvent.click(
        screen.getByRole('button', { name: `#${hex_rouge} déverrouillée` })
      )

      // Should render ColorPickerPopup instead of ColorGridView
      // Check for RGB sliders which are specific to ColorPickerPopup
      expect(screen.getAllByRole('slider')).toHaveLength(3)
    })

    it('renders ColorPickerPopup for CPC Plus mode when slot is empty', () => {
      const store = createStore()
      store.set(cpcHardwareAtom, CPCHardware.PLUS)

      render(
        <Provider store={store}>
          <ColorPaletteView {...props} />
        </Provider>
      )

      // Click on empty slot to open popover
      fireEvent.click(
        screen.getByRole('button', { name: /Ajouter une couleur/i })
      )

      // Should render ColorPickerPopup instead of ColorGridView
      // Check for RGB sliders which are specific to ColorPickerPopup
      expect(screen.getAllByRole('slider')).toHaveLength(3)
    })
  })

  describe('Classic mode', () => {
    it('renders ColorGridView for Classic mode', () => {
      const store = createStore()
      store.set(cpcHardwareAtom, CPCHardware.CLASSIC)

      render(
        <Provider store={store}>
          <ColorPaletteView {...props} />
        </Provider>
      )

      // Click on empty slot to open popover
      fireEvent.click(
        screen.getByRole('button', { name: /Ajouter une couleur/i })
      )

      // Should render ColorGridView
      expect(
        screen.getByRole('group', { name: /Options de couleur/i })
      ).toBeInTheDocument()
    })
  })

  describe('Classic mode', () => {
    it('renders ColorGridView for Classic mode', () => {
      const store = createStore()
      store.set(cpcHardwareAtom, CPCHardware.CLASSIC)

      render(
        <Provider store={store}>
          <ColorPaletteView {...props} />
        </Provider>
      )

      // Click on empty slot to open popover
      fireEvent.click(
        screen.getByRole('button', { name: /Ajouter une couleur/i })
      )

      // Should render ColorGridView
      expect(
        screen.getByRole('group', { name: /Options de couleur/i })
      ).toBeInTheDocument()
    })
  })
})
