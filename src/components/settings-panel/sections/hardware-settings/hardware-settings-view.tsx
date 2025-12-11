/**
 * Hardware settings view (dumb component)
 */

import { Trans } from '@lingui/react/macro'
import type { DimensionPreset, PixelMode } from '@/app/store/config/types'
import { ToggleButtonGroup } from '@/components/ui/toggle-button-group'
import type { CPCHardware } from '@/libs/types'
import styles from '../../tabs/tab.module.css'
import { CustomDimensionsInput } from './custom-dimensions-input/custom-dimensions-input'

type HardwareSettingsViewProps = {
  cpcHardware: CPCHardware
  onCpcHardwareChange: (value: CPCHardware) => void
  pixelMode: PixelMode
  onPixelModeChange: (value: PixelMode) => void
  dimensionPreset: DimensionPreset
  onDimensionPresetChange: (value: DimensionPreset) => void
}

export function HardwareSettingsView({
  cpcHardware,
  onCpcHardwareChange,
  pixelMode,
  onPixelModeChange,
  dimensionPreset,
  onDimensionPresetChange
}: HardwareSettingsViewProps) {
  const hardwareOptions: Array<{ value: CPCHardware; label: string }> = [
    { value: 'classic' as CPCHardware, label: 'CPC Classic (27 colors)' },
    { value: 'plus' as CPCHardware, label: 'CPC Plus (4096 colors)' }
  ]

  const pixelModeOptions: Array<{ value: PixelMode; label: string }> = [
    { value: 0, label: 'Mode 0 (160px)' },
    { value: 1, label: 'Mode 1 (320px)' },
    { value: 2, label: 'Mode 2 (640px)' }
  ]

  const dimensionPresetOptions: Array<{
    value: DimensionPreset
    label: string
  }> = [
    { value: 'standard', label: 'Standard' },
    { value: 'overscan', label: 'Overscan' },
    { value: 'custom', label: 'Custom' }
  ]

  return (
    <>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Hardware CPC</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            CPC Classic: palette de 27 couleurs fixes. CPC Plus: palette de 4096
            couleurs.
          </Trans>
        </p>

        <div className={styles.tuningRow}>
          <div className={styles.tuningHeader}>
            <span className={styles.tuningLabel}>
              <Trans>CPC Hardware</Trans>
            </span>
          </div>
          <ToggleButtonGroup
            options={hardwareOptions}
            value={cpcHardware}
            onChange={onCpcHardwareChange}
            ariaLabelPrefix='Hardware'
          />
        </div>
      </div>

      <div className={styles.separator} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Pixel Mode</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            Mode 0: 160 pixels de large, Mode 1: 320 pixels, Mode 2: 640 pixels
          </Trans>
        </p>

        <div className={styles.tuningRow}>
          <div className={styles.tuningHeader}>
            <span className={styles.tuningLabel}>
              <Trans>CPC Pixel Mode</Trans>
            </span>
          </div>
          <ToggleButtonGroup
            options={pixelModeOptions}
            value={pixelMode}
            onChange={onPixelModeChange}
            ariaLabelPrefix='Pixel Mode'
          />
        </div>
      </div>

      <div className={styles.separator} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Dimensions</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            Standard: dimensions CPC standards. Overscan: utilise toute la zone
            affichable. Custom: dimensions personnalisées.
          </Trans>
        </p>

        <div className={styles.tuningRow}>
          <div className={styles.tuningHeader}>
            <span className={styles.tuningLabel}>
              <Trans>Dimension Preset</Trans>
            </span>
          </div>
          <ToggleButtonGroup
            options={dimensionPresetOptions}
            value={dimensionPreset}
            onChange={onDimensionPresetChange}
            ariaLabelPrefix='Dimensions'
          />
        </div>

        {dimensionPreset === 'custom' && (
          <div style={{ marginTop: '16px' }}>
            <CustomDimensionsInput />
          </div>
        )}
      </div>
    </>
  )
}
