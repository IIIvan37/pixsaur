/**
 * Hardware settings view (dumb component)
 */

import { Trans } from '@lingui/react/macro'
import { useId } from 'react'
import type { DimensionPreset, PixelMode } from '@/app/store/config/types'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import Flex from '@/components/ui/flex'
import { Switch } from '@/components/ui/switch'
import { ToggleButtonGroup } from '@/components/ui/toggle-button-group'
import type { CPCHardware } from '@/libs/types'
import styles from '../../tabs/tab.module.css'
import { CustomDimensionsInput } from './custom-dimensions-input/custom-dimensions-input'
import { EGXSettings } from './egx-settings'
import { ModeRSettings } from './mode-r-settings'

type HardwareSettingsViewProps = Readonly<{
  cpcHardware: CPCHardware
  onCpcHardwareChange: (value: CPCHardware) => void
  pixelMode: PixelMode
  onPixelModeChange: (value: PixelMode) => void
  dimensionPreset: DimensionPreset
  onDimensionPresetChange: (value: DimensionPreset) => void
  modeREnabled: boolean
  onModeREnabledChange: (value: boolean) => void
  egxEnabled: boolean
  onEgxEnabledChange: (value: boolean) => void
}>

export function HardwareSettingsView({
  cpcHardware,
  onCpcHardwareChange,
  pixelMode,
  onPixelModeChange,
  dimensionPreset,
  onDimensionPresetChange,
  modeREnabled,
  onModeREnabledChange,
  egxEnabled,
  onEgxEnabledChange
}: HardwareSettingsViewProps) {
  const modeRSwitchId = useId()
  const egxSwitchId = useId()

  const hardwareOptions: Array<{ value: CPCHardware; label: string }> = [
    { value: 'classic', label: 'CPC Classic (27 colors)' },
    { value: 'plus', label: 'CPC Plus (4096 colors)' }
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

      <CollapsibleSection
        title={<Trans>Modes avancés (Mode R / EGX)</Trans>}
        defaultOpen={modeREnabled || egxEnabled}
      >
        <Flex align='center' justify='space-between' style={{ width: '100%' }}>
          <div>
            <h4 className={styles.sectionTitle}>
              <Trans>Mode R</Trans>
            </h4>
            <p className={styles.description}>
              <Trans>
                Résolution horizontale doublée (Mode 0 uniquement). Utilise 2
                images alternées à 50Hz.
              </Trans>
            </p>
          </div>
          <Switch
            checked={modeREnabled}
            onCheckedChange={onModeREnabledChange}
            id={modeRSwitchId}
          />
        </Flex>

        {modeREnabled && <ModeRSettings />}

        <Flex
          align='center'
          justify='space-between'
          style={{ width: '100%', marginTop: '16px' }}
        >
          <div>
            <h4 className={styles.sectionTitle}>
              <Trans>EGX Mode</Trans>
            </h4>
            <p className={styles.description}>
              <Trans>
                Alternance de modes ligne par ligne. EGX1: 320×200 16 couleurs.
                EGX2: 640×200 4 couleurs.
              </Trans>
            </p>
          </div>
          <Switch
            checked={egxEnabled}
            onCheckedChange={onEgxEnabledChange}
            id={egxSwitchId}
          />
        </Flex>

        {egxEnabled && <EGXSettings />}
      </CollapsibleSection>

      {!modeREnabled && !egxEnabled && (
        <>
          <div className={styles.separator} />

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Trans>Pixel Mode</Trans>
            </h3>
            <p className={styles.description}>
              <Trans>
                Mode 0: 160 pixels de large, Mode 1: 320 pixels, Mode 2: 640
                pixels
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
        </>
      )}

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
