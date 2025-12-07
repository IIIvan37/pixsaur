import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { useId } from 'react'
import type { DimensionPreset, PixelMode } from '@/app/store/config/types'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import type { CPCHardware } from '@/libs/types'
import Flex from '../ui/flex'
import { SectionTitle } from '../ui/section-title'
import { Switch } from '../ui/switch'
import { ToggleButtonGroup } from '../ui/toggle-button-group'
import { CustomDimensionsInput } from './custom-dimensions-input/custom-dimensions-input'
import { DitheringSelector } from './dithering-selector/dithering-selector'
import styles from './image-controls.module.css'
import { PaletteStrategySelector } from './palette-strategy-selector/palette-strategy-selector'
import { ProcessorSelector } from './processor-selector/processor-selector'

export type ImageControlsViewProps = {
  pixelMode: PixelMode
  onPixelModeChange: (mode: PixelMode) => void
  dimensionPreset: DimensionPreset
  onDimensionPresetChange: (preset: DimensionPreset) => void
  cpcHardware: CPCHardware
  onCpcHardwareChange: (hardware: CPCHardware) => void
  horizontalSmoothing: boolean
  onHorizontalSmoothingChange: (enabled: boolean) => void
}

/**
 * Renders the image controls UI, allowing users to select the image processing mode
 * and CPC hardware configuration. ColorSpace is now fixed to RGB for optimal GPU performance.
 *
 * @param props - The props for the ImageControlsView component.
 * @param props.pixelMode - The current pixel aspect ratio mode (0, 1, or 2).
 * @param props.onPixelModeChange - Callback invoked when the pixel mode is changed.
 * @param props.dimensionPreset - The current dimension preset (standard or overscan).
 * @param props.onDimensionPresetChange - Callback invoked when the dimension preset is changed.
 * @param props.cpcHardware - The currently selected CPC hardware.
 * @param props.onCpcHardwareChange - Callback invoked when the hardware is changed.
 *
 * @returns The rendered image controls view component.
 */
export function ImageControlsView({
  pixelMode,
  onPixelModeChange,
  dimensionPreset,
  onDimensionPresetChange,
  cpcHardware,
  onCpcHardwareChange,
  horizontalSmoothing,
  onHorizontalSmoothingChange
}: Readonly<ImageControlsViewProps>) {
  const horizontalSmoothingId = useId()
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  // Pixel mode options (0, 1, 2)
  const pixelModeOptions: Array<{ value: PixelMode; label: string }> = [
    { value: 0, label: 'Mode 0' },
    { value: 1, label: 'Mode 1' },
    { value: 2, label: 'Mode 2' }
  ]

  // Dimension preset options (standard, overscan, custom)
  const dimensionPresetOptions: Array<{
    value: DimensionPreset
    label: string
  }> = [
    { value: 'standard', label: 'Standard' },
    { value: 'overscan', label: 'Overscan' },
    { value: 'custom', label: 'Custom' }
  ]

  const hardwareOptions: Array<{ value: CPCHardware; label: string }> = [
    { value: 'classic' as CPCHardware, label: 'CPC (27)' },
    { value: 'plus' as CPCHardware, label: 'CPC+ (4096)' }
  ]

  return (
    <div className={styles.controlsContainer}>
      {/* Configuration matérielle et mode */}
      <div className={styles.section}>
        <Flex align='center'>
          <SectionTitle>
            <Trans>Hardware</Trans>
          </SectionTitle>
          <ToggleButtonGroup
            options={hardwareOptions}
            value={cpcHardware}
            onChange={onCpcHardwareChange}
            ariaLabelPrefix='Hardware'
          />
        </Flex>

        <Flex align='center'>
          <SectionTitle>
            <Trans>Pixel Mode</Trans>
          </SectionTitle>
          <ToggleButtonGroup
            options={pixelModeOptions}
            value={pixelMode}
            onChange={onPixelModeChange}
            ariaLabelPrefix='Pixel Mode'
          />
        </Flex>

        <Flex align='center'>
          <SectionTitle>
            <Trans>Dimensions</Trans>
          </SectionTitle>
          <ToggleButtonGroup
            options={dimensionPresetOptions}
            value={dimensionPreset}
            onChange={onDimensionPresetChange}
            ariaLabelPrefix='Dimensions'
          />
        </Flex>

        {/* Show custom dimensions input when custom preset is selected */}
        {dimensionPreset === 'custom' && <CustomDimensionsInput />}
      </div>

      {/* Sélection de palette */}
      <PaletteStrategySelector />

      {/* Traitement d'image */}
      <div className={styles.section}>
        <DitheringSelector />

        {!rasterEnabled && (
          <Flex
            align='center'
            justify='space-between'
            style={{ width: '100%' }}
          >
            <SectionTitle>
              <Trans>Lissage horizontal</Trans>
            </SectionTitle>
            <Switch
              checked={horizontalSmoothing}
              onCheckedChange={onHorizontalSmoothingChange}
              id={horizontalSmoothingId}
            />
          </Flex>
        )}
      </div>

      {/* Options avancées */}
      <ProcessorSelector />
    </div>
  )
}
