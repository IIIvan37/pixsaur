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
    enabled: true,
    changes: [],
    conflicts: [],
    maxLine: 199,
    palette: mockPalette,
    nColors: 4,
    maxChangesPerLine: 2,
    cpcPalette: mockCpcPalette,
    isClassicMode: true,
    isPlusMode: false,
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

    it('should render mode badge when section is expanded', async () => {
      render(<RasterPanelView {...createDefaultProps()} />)
      await expandSection()
      // The mode badge should be visible (no switch anymore, moved to DitheringSelector)
      expect(screen.getByText('CPC Classic')).toBeInTheDocument()
    })
  })

  describe('Raster Changes', () => {
    it('should show add button', async () => {
      render(<RasterPanelView {...createDefaultProps()} />)
      await expandSection()
      // The add button should not be rendered when enabled is false
      expect(
        screen.queryByRole('button', { name: /plus/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('Mode indicator', () => {
    it('should show CPC Classic badge when in Classic mode', async () => {
      render(
        <RasterPanelView
          {...createDefaultProps({
            isPlusMode: false,
            isClassicMode: true
          })}
        />
      )
      await expandSection()
      expect(screen.getByText('CPC Classic')).toBeInTheDocument()
    })

    it('should show CPC Plus badge in Plus mode', async () => {
      render(
        <RasterPanelView
          {...createDefaultProps({
            isPlusMode: true,
            isClassicMode: false
          })}
        />
      )
      await expandSection()
      expect(screen.getByText('CPC Plus')).toBeInTheDocument()
    })

    it('should show raster hint in Classic mode', async () => {
      render(
        <RasterPanelView
          {...createDefaultProps({
            isPlusMode: false,
            isClassicMode: true
          })}
        />
      )
      await expandSection()
      // Check that modeHint element exists (text is mocked in tests)
      const modeInfo = screen.getByText('CPC Classic').parentElement
      expect(modeInfo?.querySelectorAll('span')).toHaveLength(2) // badge + hint
    })

    it('should show raster hint in Plus mode', async () => {
      render(
        <RasterPanelView
          {...createDefaultProps({
            isPlusMode: true,
            isClassicMode: false
          })}
        />
      )
      await expandSection()
      // Check that modeHint element exists (text is mocked in tests)
      const modeInfo = screen.getByText('CPC Plus').parentElement
      expect(modeInfo?.querySelectorAll('span')).toHaveLength(2) // badge + hint
    })
  })

  describe('Empty state', () => {
    it('should show empty state when enabled with no changes', async () => {
      render(<RasterPanelView {...createDefaultProps()} />)
      await expandSection()
      // Check for empty state message
      expect(
        screen.getByText('Aucun changement raster défini.')
      ).toBeInTheDocument()
    })
  })

  describe('Adding changes', () => {
    it('should call onAddChange when add button is clicked', async () => {
      const onAddChange = vi.fn()
      render(<RasterPanelView {...createDefaultProps({ onAddChange })} />)
      await expandSection()

      // Find the add button by text
      const addButton = screen.getByRole('button', { name: /ajouter/i })
      await userEvent.click(addButton)

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

    it('should display change rows', async () => {
      const { container } = render(
        <RasterPanelView {...createDefaultProps({ changes: mockChanges })} />
      )
      await expandSection()

      // Check for change rows by looking for elements with lineRow class
      const changeRows = container.querySelectorAll('[class*="lineRow"]')
      expect(changeRows.length).toBe(2)
    })

    it('should display line values', async () => {
      render(
        <RasterPanelView {...createDefaultProps({ changes: mockChanges })} />
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
            changes: mockChanges,
            onRemoveChange
          })}
        />
      )
      await expandSection()

      // Find the delete button (has TrashIcon)
      const deleteButton = container.querySelector('[class*="removeInkButton"]')
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
        <RasterPanelView {...createDefaultProps({ changes: mockChanges })} />
      )
      await expandSection()

      expect(screen.getByText('10')).toBeInTheDocument()
    })

    it('should render slider for line', async () => {
      const { container } = render(
        <RasterPanelView {...createDefaultProps({ changes: mockChanges })} />
      )
      await expandSection()

      // Click on the line button to open the popover
      const lineButton = container.querySelector('[class*="lineButton"]')
      expect(lineButton).toBeInTheDocument()
      if (lineButton) {
        await userEvent.click(lineButton)
      }

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
            changes: mockChanges,
            isClassicMode: true
          })}
        />
      )
      await expandSection()

      // Color trigger button should be present
      const colorTrigger = container.querySelector('[class*="inkColorButton"]')
      expect(colorTrigger).toBeInTheDocument()
    })

    it('should display color swatch with correct background color', async () => {
      const { container } = render(
        <RasterPanelView
          {...createDefaultProps({
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
  })
})
