import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { CPCColor } from '@/libs/types'
import { renderWithProviders } from '@/test-utils'
import { RasterSettingsView } from './raster-settings-view'

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
  }
]

const mockPalette: Vector[] = [
  [0, 0, 0],
  [0, 0, 255],
  [255, 0, 0],
  [0, 255, 0]
]

function createDefaultProps(overrides = {}) {
  return {
    rasterEnabled: true,
    onRasterEnabledChange: vi.fn(),
    isDistinctMappingActive: false,
    maxChangesPerLine: 2,
    onMaxChangesPerLineChange: vi.fn(),
    hardwareLimit: 4,
    rasterDitheringIntensity: 0.75,
    onRasterDitheringIntensityChange: vi.fn(),
    hasImage: true,
    isOptimizing: false,
    hasGeneratedRasters: false,
    onAutoOptimize: vi.fn(),
    verticalErrorCoef: 0.125,
    onVerticalErrorCoefChange: vi.fn(),
    horizontalErrorCoef: 0.5,
    onHorizontalErrorCoefChange: vi.fn(),
    showPreprocessParams: true,
    preprocessContinuityDistance: 867,
    onPreprocessContinuityDistanceChange: vi.fn(),
    preprocessContinuityBonus: 1.5,
    onPreprocessContinuityBonusChange: vi.fn(),
    preprocessFrequencyExponent: 0.5,
    onPreprocessFrequencyExponentChange: vi.fn(),
    changes: [],
    conflicts: [],
    maxLine: 199,
    palette: mockPalette,
    nColors: 4,
    cpcPalette: mockCpcPalette,
    isClassicMode: false,
    isPlusMode: true,
    onAddChange: vi.fn(),
    onUpdateChange: vi.fn(),
    onRemoveChange: vi.fn(),
    onClearAll: vi.fn(),
    ...overrides
  }
}

describe('RasterSettingsView', () => {
  describe('Preprocessing parameters visibility', () => {
    it('should show preprocessing section when showPreprocessParams is true', () => {
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({ showPreprocessParams: true })}
        />
      )

      // The preprocessing section should be visible - check for a slider that only appears in this section
      expect(screen.getByText('Distance de continuité')).toBeInTheDocument()
    })

    it('should hide preprocessing section when showPreprocessParams is false', () => {
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({ showPreprocessParams: false })}
        />
      )

      // The section title should NOT be visible
      expect(
        screen.queryByText('Extraction palette de base')
      ).not.toBeInTheDocument()
    })

    it('should show continuity distance slider when showPreprocessParams is true', () => {
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({ showPreprocessParams: true })}
        />
      )

      expect(screen.getByText('Distance de continuité')).toBeInTheDocument()
    })

    it('should show continuity bonus slider when showPreprocessParams is true', () => {
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({ showPreprocessParams: true })}
        />
      )

      expect(screen.getByText('Bonus de continuité')).toBeInTheDocument()
    })

    it('should show frequency exponent slider when showPreprocessParams is true', () => {
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({ showPreprocessParams: true })}
        />
      )

      expect(screen.getByText('Poids de fréquence')).toBeInTheDocument()
    })

    it('should hide all preprocessing sliders when showPreprocessParams is false', () => {
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({ showPreprocessParams: false })}
        />
      )

      expect(
        screen.queryByText('Distance de continuité')
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Bonus de continuité')).not.toBeInTheDocument()
      expect(screen.queryByText('Poids de fréquence')).not.toBeInTheDocument()
    })
  })

  describe('Combined visibility scenarios', () => {
    it('should show preprocessing params in Mode 1 (4 colors) Plus mode when raster enabled', () => {
      // Mode 1 = 4 colors, showPreprocessParams should be true (nColors < 16)
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            rasterEnabled: true,
            showPreprocessParams: true,
            nColors: 4,
            isPlusMode: true
          })}
        />
      )

      // Check for preprocessing sliders (unique to that section)
      expect(screen.getByText('Distance de continuité')).toBeInTheDocument()
    })

    it('should show preprocessing params in Mode 2 (2 colors) Classic mode when raster enabled', () => {
      // Mode 2 = 2 colors, showPreprocessParams should be true (nColors < 16)
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            rasterEnabled: true,
            showPreprocessParams: true,
            nColors: 2,
            isClassicMode: true,
            isPlusMode: false
          })}
        />
      )

      // Check for preprocessing sliders (unique to that section)
      expect(screen.getByText('Distance de continuité')).toBeInTheDocument()
    })

    it('should hide preprocessing params in Mode 0 even when raster enabled', () => {
      // Mode 0 = 16 colors, showPreprocessParams should be false
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            rasterEnabled: true,
            showPreprocessParams: false,
            nColors: 16,
            isPlusMode: true
          })}
        />
      )

      expect(
        screen.queryByText('Extraction palette de base')
      ).not.toBeInTheDocument()
    })

    it('should hide all config sections when raster disabled', () => {
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            rasterEnabled: false,
            showPreprocessParams: true
          })}
        />
      )

      // Only the switch section should be visible
      expect(screen.getByText('Mode Raster')).toBeInTheDocument()
      // Config sections should be hidden
      expect(screen.queryByText('Paramètres Raster')).not.toBeInTheDocument()
      expect(
        screen.queryByText("Propagation d'erreur de dithering")
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Changements Raster')).not.toBeInTheDocument()
    })
  })

  describe('Raster changes section', () => {
    it('should show raster changes section when rasterEnabled is true', () => {
      renderWithProviders(
        <RasterSettingsView {...createDefaultProps({ rasterEnabled: true })} />
      )

      expect(screen.getByText('Changements Raster')).toBeInTheDocument()
    })

    it('should hide raster changes section when rasterEnabled is false', () => {
      renderWithProviders(
        <RasterSettingsView {...createDefaultProps({ rasterEnabled: false })} />
      )

      expect(screen.queryByText('Changements Raster')).not.toBeInTheDocument()
    })
  })

  describe('Empty rasters warning', () => {
    it('should show warning when hasGeneratedRasters is true but changes is empty', () => {
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            rasterEnabled: true,
            hasGeneratedRasters: true,
            changes: []
          })}
        />
      )

      expect(screen.getByText(/couleurs optimales/)).toBeInTheDocument()
    })

    it('should not show warning when hasGeneratedRasters is false', () => {
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            rasterEnabled: true,
            hasGeneratedRasters: false,
            changes: []
          })}
        />
      )

      expect(screen.queryByText(/couleurs optimales/)).not.toBeInTheDocument()
    })

    it('should not show warning when changes exist', () => {
      const mockChange = {
        id: '1',
        line: 0,
        inkIndex: 0,
        color: [255, 0, 0] as [number, number, number]
      }
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            rasterEnabled: true,
            hasGeneratedRasters: true,
            changes: [mockChange]
          })}
        />
      )

      expect(screen.queryByText(/couleurs optimales/)).not.toBeInTheDocument()
    })
  })
})
