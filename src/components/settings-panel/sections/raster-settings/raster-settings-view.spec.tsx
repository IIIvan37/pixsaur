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
    rasterEnabled: false,
    onRasterEnabledChange: vi.fn(),
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
    isMode0Plus: false,
    mode0PixelWeight: 1,
    onMode0PixelWeightChange: vi.fn(),
    mode0LineWeight: 2,
    onMode0LineWeightChange: vi.fn(),
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

  describe('Mode 0 Plus section visibility', () => {
    it('should show Mode 0 Plus section when isMode0Plus is true', () => {
      renderWithProviders(
        <RasterSettingsView {...createDefaultProps({ isMode0Plus: true })} />
      )

      expect(screen.getByText('Mode 0 CPC Plus (12+4)')).toBeInTheDocument()
    })

    it('should hide Mode 0 Plus section when isMode0Plus is false', () => {
      renderWithProviders(
        <RasterSettingsView {...createDefaultProps({ isMode0Plus: false })} />
      )

      expect(
        screen.queryByText('Mode 0 CPC Plus (12+4)')
      ).not.toBeInTheDocument()
    })

    it('should show pixel weight slider when isMode0Plus is true', () => {
      renderWithProviders(
        <RasterSettingsView {...createDefaultProps({ isMode0Plus: true })} />
      )

      expect(screen.getByText('Poids fréquence pixels')).toBeInTheDocument()
    })

    it('should show line weight slider when isMode0Plus is true', () => {
      renderWithProviders(
        <RasterSettingsView {...createDefaultProps({ isMode0Plus: true })} />
      )

      expect(screen.getByText('Poids couverture lignes')).toBeInTheDocument()
    })
  })

  describe('Combined visibility scenarios', () => {
    it('should show preprocessing params in Mode 1 (4 colors) Plus mode', () => {
      // Mode 1 = 4 colors, showPreprocessParams should be true (nColors < 16)
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            showPreprocessParams: true,
            isMode0Plus: false,
            nColors: 4,
            isPlusMode: true
          })}
        />
      )

      // Check for preprocessing sliders (unique to that section)
      expect(screen.getByText('Distance de continuité')).toBeInTheDocument()
      expect(
        screen.queryByText('Mode 0 CPC Plus (12+4)')
      ).not.toBeInTheDocument()
    })

    it('should show preprocessing params in Mode 2 (2 colors) Classic mode', () => {
      // Mode 2 = 2 colors, showPreprocessParams should be true (nColors < 16)
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            showPreprocessParams: true,
            isMode0Plus: false,
            nColors: 2,
            isClassicMode: true,
            isPlusMode: false
          })}
        />
      )

      // Check for preprocessing sliders (unique to that section)
      expect(screen.getByText('Distance de continuité')).toBeInTheDocument()
      expect(
        screen.queryByText('Mode 0 CPC Plus (12+4)')
      ).not.toBeInTheDocument()
    })

    it('should hide preprocessing params and show Mode 0 Plus in Mode 0 Plus', () => {
      // Mode 0 Plus = 16 colors, showPreprocessParams should be false
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            showPreprocessParams: false,
            isMode0Plus: true,
            nColors: 16,
            isPlusMode: true
          })}
        />
      )

      expect(
        screen.queryByText('Extraction palette de base')
      ).not.toBeInTheDocument()
      expect(screen.getByText('Mode 0 CPC Plus (12+4)')).toBeInTheDocument()
    })

    it('should hide both sections in Mode 0 Classic', () => {
      // Mode 0 Classic = 16 colors, no Mode 0 Plus specific section
      renderWithProviders(
        <RasterSettingsView
          {...createDefaultProps({
            showPreprocessParams: false,
            isMode0Plus: false,
            nColors: 16,
            isClassicMode: true,
            isPlusMode: false
          })}
        />
      )

      expect(
        screen.queryByText('Extraction palette de base')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('Mode 0 CPC Plus (12+4)')
      ).not.toBeInTheDocument()
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
})
