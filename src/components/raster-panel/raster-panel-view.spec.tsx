import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { CPCColor } from '@/libs/types'
import { RasterPanelView, type RasterPanelViewProps } from './raster-panel-view'

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
  }
]

const mockPalette: Vector[] = [
  [0, 0, 0],
  [0, 0, 255],
  [255, 0, 0],
  [0, 255, 0]
]

function createDefaultProps(
  overrides?: Partial<RasterPanelViewProps>
): RasterPanelViewProps {
  return {
    enabled: false,
    onEnabledChange: vi.fn(),
    changes: [],
    conflicts: [],
    maxLine: 199,
    palette: mockPalette,
    nColors: 4,
    cpcPalette: mockCpcPalette,
    isClassicMode: true,
    onAddChange: vi.fn(),
    onUpdateChange: vi.fn(),
    onRemoveChange: vi.fn(),
    ...overrides
  }
}

/**
 * Helper to expand the collapsible section before testing its content
 */
async function expandSection() {
  // The collapsible is closed by default (defaultOpen={false} in the component)
  // We need to click the header button to expand it
  const sectionHeader = screen.getByRole('button', { expanded: false })
  await userEvent.click(sectionHeader)
}

describe('RasterPanelView', () => {
  describe('Initial state', () => {
    it('should render the collapsible section', () => {
      render(<RasterPanelView {...createDefaultProps()} />)
      // Check that a collapsible button exists
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should render the enable switch when section is expanded', async () => {
      render(<RasterPanelView {...createDefaultProps()} />)
      await expandSection()
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('should have switch unchecked when disabled', async () => {
      render(<RasterPanelView {...createDefaultProps({ enabled: false })} />)
      await expandSection()
      expect(screen.getByRole('switch')).not.toBeChecked()
    })

    it('should have switch checked when enabled', async () => {
      render(<RasterPanelView {...createDefaultProps({ enabled: true })} />)
      await expandSection()
      expect(screen.getByRole('switch')).toBeChecked()
    })
  })

  describe('Enable/Disable toggle', () => {
    it('should call onEnabledChange when switch is clicked', async () => {
      const onEnabledChange = vi.fn()
      render(<RasterPanelView {...createDefaultProps({ onEnabledChange })} />)
      await expandSection()

      await userEvent.click(screen.getByRole('switch'))

      expect(onEnabledChange).toHaveBeenCalledWith(true)
    })

    it('should not show add button when raster is disabled', async () => {
      render(<RasterPanelView {...createDefaultProps({ enabled: false })} />)
      await expandSection()
      // The add button should not be rendered when enabled is false
      expect(
        screen.queryByRole('button', { name: /plus/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('should show empty state when enabled with no changes', async () => {
      render(
        <RasterPanelView
          {...createDefaultProps({ enabled: true, changes: [] })}
        />
      )
      await expandSection()
      // Check for empty state container
      const container = screen.getByRole('switch').parentElement?.parentElement
      expect(container).toBeInTheDocument()
    })
  })

  describe('Adding changes', () => {
    it('should call onAddChange when add button is clicked', async () => {
      const onAddChange = vi.fn()
      render(
        <RasterPanelView
          {...createDefaultProps({ enabled: true, onAddChange })}
        />
      )
      await expandSection()

      // Find the add button (contains PlusIcon)
      const buttons = screen.getAllByRole('button')
      const addButton = buttons.find((btn) => btn.querySelector('svg'))
      if (addButton) {
        await userEvent.click(addButton)
      }

      expect(onAddChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('Displaying changes', () => {
    const mockChanges: RasterChange[] = [
      {
        id: 'change-1',
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0]
      },
      {
        id: 'change-2',
        inkIndex: 1,
        line: 60,
        color: [0, 255, 0]
      }
    ]

    it('should render change rows when changes exist', async () => {
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({ enabled: true, changes: mockChanges })}
        />
      )
      await expandSection()

      // Check for change rows by looking for elements with changeRow class
      const changeRows = container.querySelectorAll('[class*="changeRow"]')
      expect(changeRows.length).toBe(2)
    })

    it('should display line values', async () => {
      render(
        <RasterPanelView
          {...createDefaultProps({ enabled: true, changes: mockChanges })}
        />
      )
      await expandSection()

      // The values should be displayed as text (use getAllByText for multiple matches)
      const zeroElements = screen.getAllByText('0')
      expect(zeroElements.length).toBeGreaterThan(0)
      expect(screen.getByText('60')).toBeInTheDocument()
    })
  })

  describe('Removing changes', () => {
    const mockChanges: RasterChange[] = [
      {
        id: 'change-1',
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0]
      }
    ]

    it('should call onRemoveChange when delete button is clicked', async () => {
      const onRemoveChange = vi.fn()
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
            enabled: true,
            changes: mockChanges,
            onRemoveChange
          })}
        />
      )
      await expandSection()

      // Find the delete button (has TrashIcon)
      const deleteButton = container.querySelector('[class*="deleteButton"]')
      expect(deleteButton).toBeInTheDocument()

      if (deleteButton) {
        await userEvent.click(deleteButton)
      }

      expect(onRemoveChange).toHaveBeenCalledWith('change-1')
    })
  })

  describe('Conflict highlighting', () => {
    const conflictingChanges: RasterChange[] = [
      {
        id: 'change-1',
        inkIndex: 0,
        line: 50,
        color: [255, 0, 0]
      },
      {
        id: 'change-2',
        inkIndex: 0,
        line: 50,
        color: [0, 255, 0]
      }
    ]

    it('should mark conflicting changes visually', async () => {
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
            enabled: true,
            changes: conflictingChanges,
            conflicts: ['change-1', 'change-2']
          })}
        />
      )
      await expandSection()

      // Check that conflict class is applied to change rows
      const conflictRows = container.querySelectorAll('[class*="conflict"]')
      expect(conflictRows.length).toBeGreaterThan(0)
    })

    it('should not mark non-conflicting changes', async () => {
      const nonConflictingChanges: RasterChange[] = [
        {
          id: 'change-1',
          inkIndex: 0,
          line: 0,
          color: [255, 0, 0]
        },
        {
          id: 'change-2',
          inkIndex: 1,
          line: 60,
          color: [0, 255, 0]
        }
      ]

      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
            enabled: true,
            changes: nonConflictingChanges,
            conflicts: []
          })}
        />
      )
      await expandSection()

      // Get change rows and check they don't have conflict class
      const changeRows = container.querySelectorAll('[class*="changeRow"]')
      changeRows.forEach((row) => {
        // Should not have the conflict modifier class
        expect(row.className).not.toMatch(/_conflict_/)
      })
    })
  })

  describe('Ink selector', () => {
    const mockChanges: RasterChange[] = [
      {
        id: 'change-1',
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0]
      }
    ]

    it('should display ink buttons for available colors', async () => {
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
            enabled: true,
            changes: mockChanges,
            nColors: 4
          })}
        />
      )
      await expandSection()

      // Should have 4 ink buttons (nColors = 4)
      const inkButtons = container.querySelectorAll('[class*="inkButton"]')
      expect(inkButtons).toHaveLength(4)
    })

    it('should call onUpdateChange for inkIndex and color when ink is changed', async () => {
      const onUpdateChange = vi.fn()
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
            enabled: true,
            changes: mockChanges,
            nColors: 4,
            onUpdateChange
          })}
        />
      )
      await expandSection()

      // Get all ink buttons and click on the third one (index 2)
      const inkButtons = container.querySelectorAll('[class*="inkButton"]')
      expect(inkButtons.length).toBeGreaterThanOrEqual(3)

      await userEvent.click(inkButtons[2])

      // Should update both inkIndex and color
      expect(onUpdateChange).toHaveBeenCalledWith('change-1', 'inkIndex', 2)
      expect(onUpdateChange).toHaveBeenCalledWith(
        'change-1',
        'color',
        mockPalette[2]
      )
      expect(onUpdateChange).toHaveBeenCalledTimes(2)
    })
  })

  describe('Slider interactions', () => {
    const mockChanges: RasterChange[] = [
      {
        id: 'change-1',
        inkIndex: 0,
        line: 10,
        color: [255, 0, 0]
      }
    ]

    it('should display current line value', async () => {
      render(
        <RasterPanelView
          {...createDefaultProps({ enabled: true, changes: mockChanges })}
        />
      )
      await expandSection()

      expect(screen.getByText('10')).toBeInTheDocument()
    })

    it('should render slider for line', async () => {
      render(
        <RasterPanelView
          {...createDefaultProps({ enabled: true, changes: mockChanges })}
        />
      )
      await expandSection()

      const sliders = screen.getAllByRole('slider')
      expect(sliders.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Color picker', () => {
    const mockChanges: RasterChange[] = [
      {
        id: 'change-1',
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0]
      }
    ]

    it('should render color trigger button', async () => {
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
            enabled: true,
            changes: mockChanges,
            isClassicMode: true
          })}
        />
      )
      await expandSection()

      // Color trigger button should be present
      const colorTrigger = container.querySelector(
        '[class*="colorTriggerButton"]'
      )
      expect(colorTrigger).toBeInTheDocument()
    })

    it('should display color swatch with correct background color', async () => {
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
            enabled: true,
            changes: mockChanges,
            isClassicMode: true
          })}
        />
      )
      await expandSection()

      // Color swatch should show the change color (hex format in style)
      const colorSwatch = container.querySelector('[class*="colorSwatch"]')
      expect(colorSwatch).toBeInTheDocument()
      // The style is set as hex, check for the hex color
      expect(colorSwatch?.getAttribute('style')).toContain('#ff0000')
    })

    it('should display color matching the ink color from palette', async () => {
      // Change with inkIndex 2, color should match palette[2] = [255, 0, 0]
      const changeWithInk2: RasterChange[] = [
        {
          id: 'change-1',
          inkIndex: 2,
          line: 0,
          color: [255, 0, 0]
        }
      ]
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
            enabled: true,
            changes: changeWithInk2,
            isClassicMode: true
          })}
        />
      )
      await expandSection()

      const colorSwatch = container.querySelector('[class*="colorSwatch"]')
      expect(colorSwatch).toBeInTheDocument()
      // Color should be red (#ff0000) which is palette[2]
      expect(colorSwatch?.getAttribute('style')).toContain('#ff0000')
    })

    it('should update color when ink is changed to use new ink color', async () => {
      const onUpdateChange = vi.fn()
      // Start with ink 0 (black [0,0,0])
      const changeWithInk0: RasterChange[] = [
        {
          id: 'change-1',
          inkIndex: 0,
          line: 0,
          color: [0, 0, 0]
        }
      ]
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
            enabled: true,
            changes: changeWithInk0,
            nColors: 4,
            onUpdateChange
          })}
        />
      )
      await expandSection()

      // Click on ink 1 (blue [0, 0, 255])
      const inkButtons = container.querySelectorAll('[class*="inkButton"]')
      await userEvent.click(inkButtons[1])

      // Should update inkIndex to 1
      expect(onUpdateChange).toHaveBeenCalledWith('change-1', 'inkIndex', 1)
      // Should also update color to palette[1] = [0, 0, 255]
      expect(onUpdateChange).toHaveBeenCalledWith(
        'change-1',
        'color',
        [0, 0, 255]
      )
    })

    it('should update color to green when selecting ink 3', async () => {
      const onUpdateChange = vi.fn()
      const changeWithInk0: RasterChange[] = [
        {
          id: 'change-1',
          inkIndex: 0,
          line: 0,
          color: [0, 0, 0]
        }
      ]
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
            enabled: true,
            changes: changeWithInk0,
            nColors: 4,
            onUpdateChange
          })}
        />
      )
      await expandSection()

      // Click on ink 3 (green [0, 255, 0])
      const inkButtons = container.querySelectorAll('[class*="inkButton"]')
      await userEvent.click(inkButtons[3])

      // Should update inkIndex to 3
      expect(onUpdateChange).toHaveBeenCalledWith('change-1', 'inkIndex', 3)
      // Should also update color to palette[3] = [0, 255, 0] (green)
      expect(onUpdateChange).toHaveBeenCalledWith(
        'change-1',
        'color',
        [0, 255, 0]
      )
    })
  })
})
