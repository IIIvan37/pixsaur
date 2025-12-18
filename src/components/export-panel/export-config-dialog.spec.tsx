import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAtomValue } from 'jotai'
import type { Mock } from 'vitest'
import { renderWithProviders } from '@/test-utils'
import ExportConfigDialog from './export-config-dialog'

// Mock jotai useAtomValue
vi.mock('jotai', async () => {
  const actual = await vi.importActual('jotai')
  return {
    ...actual,
    useAtomValue: vi.fn()
  }
})

vi.mock('@/components/ui/icon')

const mockedUseAtomValue = useAtomValue as Mock

describe('ExportConfigDialog', () => {
  const onOpenChange = vi.fn()
  const onConfirm = vi.fn()

  const standardModeConfig = {
    mode: 0,
    width: 160,
    height: 200,
    overscan: false,
    nColors: 16,
    scaleX: 2,
    scaleY: 1
  }

  const overscanModeConfig = {
    mode: 0,
    width: 192,
    height: 280,
    overscan: true,
    nColors: 16,
    scaleX: 2,
    scaleY: 1
  }

  const customModeConfig = {
    mode: 0,
    width: 128,
    height: 128,
    overscan: false,
    nColors: 16,
    scaleX: 2,
    scaleY: 1
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: standard mode, no rasters
    mockedUseAtomValue.mockReturnValue(standardModeConfig)
  })

  function renderDialog(open = true) {
    return renderWithProviders(
      <ExportConfigDialog
        open={open}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    )
  }

  // Helper to get all checkboxes
  function getAllCheckboxes() {
    return screen.getAllByRole('checkbox')
  }

  // SNA is the 4th checkbox (after SCR, Linear, Palettes)
  function getSnaCheckbox() {
    const checkboxes = getAllCheckboxes()
    return checkboxes[3] // 0: SCR, 1: Linear, 2: Palettes, 3: SNA
  }

  // SCR is the 1st checkbox
  function getScrCheckbox() {
    const checkboxes = getAllCheckboxes()
    return checkboxes[0]
  }

  describe('SNA export availability', () => {
    it('enables SNA checkbox for standard mode', () => {
      mockedUseAtomValue.mockReturnValue(standardModeConfig)

      renderDialog()

      const snaCheckbox = getSnaCheckbox()
      expect(snaCheckbox).not.toBeDisabled()
    })

    it('enables SNA checkbox for overscan mode', () => {
      mockedUseAtomValue.mockReturnValue(overscanModeConfig)

      renderDialog()

      const snaCheckbox = getSnaCheckbox()
      expect(snaCheckbox).not.toBeDisabled()
    })

    it('disables SNA checkbox for custom (non-standard, non-overscan) mode', () => {
      mockedUseAtomValue.mockReturnValue(customModeConfig)

      renderDialog()

      const snaCheckbox = getSnaCheckbox()
      expect(snaCheckbox).toBeDisabled()
    })

    it('shows tooltip on SNA checkbox when disabled', () => {
      mockedUseAtomValue.mockReturnValue(customModeConfig)

      renderDialog()

      const snaCheckbox = getSnaCheckbox()
      expect(snaCheckbox).toHaveAttribute('title')
    })
  })

  describe('SCR export availability', () => {
    it('enables SCR checkbox for standard mode', () => {
      mockedUseAtomValue.mockReturnValue(standardModeConfig)

      renderDialog()

      const scrCheckbox = getScrCheckbox()
      expect(scrCheckbox).not.toBeDisabled()
    })

    it('enables SCR checkbox for custom mode with size <= 16KB', () => {
      mockedUseAtomValue.mockReturnValue(customModeConfig)

      renderDialog()

      const scrCheckbox = getScrCheckbox()
      // 128x128 / 2 = 8192 bytes < 16384
      expect(scrCheckbox).not.toBeDisabled()
    })

    it('disables SCR checkbox for oversized custom mode', () => {
      const oversizedConfig = {
        ...customModeConfig,
        width: 320,
        height: 400 // 320x400 / 2 = 64000 bytes > 16384
      }
      mockedUseAtomValue.mockReturnValue(oversizedConfig)

      renderDialog()

      const scrCheckbox = getScrCheckbox()
      expect(scrCheckbox).toBeDisabled()
    })
  })

  describe('checkbox interactions', () => {
    it('can toggle SNA checkbox when enabled', async () => {
      mockedUseAtomValue.mockReturnValue(standardModeConfig)

      renderDialog()

      const snaCheckbox = getSnaCheckbox()

      // SNA is unchecked by default
      expect(snaCheckbox).not.toBeChecked()

      // Click to check
      await userEvent.click(snaCheckbox)
      expect(snaCheckbox).toBeChecked()

      // Click to uncheck
      await userEvent.click(snaCheckbox)
      expect(snaCheckbox).not.toBeChecked()
    })

    it('cannot toggle SNA checkbox when disabled', async () => {
      mockedUseAtomValue.mockReturnValue(customModeConfig)

      renderDialog()

      const snaCheckbox = getSnaCheckbox()

      expect(snaCheckbox).toBeDisabled()
      expect(snaCheckbox).not.toBeChecked()

      // Attempt to click disabled checkbox
      await userEvent.click(snaCheckbox)
      expect(snaCheckbox).not.toBeChecked()
    })
  })

  describe('confirm and cancel', () => {
    it('calls onConfirm with config when Exporter button is clicked', async () => {
      mockedUseAtomValue.mockReturnValue(standardModeConfig)

      renderDialog()

      const exportButton = screen.getByRole('button', { name: /Exporter/i })
      await userEvent.click(exportButton)

      expect(onConfirm).toHaveBeenCalledTimes(1)
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            includeSNA: expect.any(Boolean)
          })
        })
      )
    })

    it('calls onOpenChange(false) when Annuler button is clicked', async () => {
      mockedUseAtomValue.mockReturnValue(standardModeConfig)

      renderDialog()

      const cancelButton = screen.getByRole('button', { name: /Annuler/i })
      await userEvent.click(cancelButton)

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('includes SNA in config when checkbox is checked before export', async () => {
      mockedUseAtomValue.mockReturnValue(standardModeConfig)

      renderDialog()

      // Check SNA
      const snaCheckbox = getSnaCheckbox()
      await userEvent.click(snaCheckbox)

      // Export
      const exportButton = screen.getByRole('button', { name: /Exporter/i })
      await userEvent.click(exportButton)

      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            includeSNA: true
          })
        })
      )
    })
  })
})
