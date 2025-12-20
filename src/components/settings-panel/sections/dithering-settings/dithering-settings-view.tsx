/**
 * Dithering settings view (dumb component)
 */

import { Trans } from '@lingui/react/macro'
import { useId } from 'react'
import Flex from '@/components/ui/flex'
import { Switch } from '@/components/ui/switch'
import styles from '../../tabs/tab.module.css'
import { DitheringControls } from './dithering-controls'
import { PaletteStrategySelector } from './palette-strategy-selector/palette-strategy-selector'

type DitheringSettingsViewProps = Readonly<{
  horizontalSmoothing: boolean
  onHorizontalSmoothingChange: (value: boolean) => void
  rasterEnabled: boolean
  isPaletteStrategyDisabled: boolean
}>

export function DitheringSettingsView({
  horizontalSmoothing,
  onHorizontalSmoothingChange,
  rasterEnabled,
  isPaletteStrategyDisabled
}: DitheringSettingsViewProps) {
  const smoothingId = useId()

  return (
    <>
      <div className={styles.section}>
        <h3
          className={styles.sectionTitle}
          style={{ opacity: isPaletteStrategyDisabled ? 0.5 : 1 }}
        >
          <Trans>Stratégie de palette</Trans>
        </h3>
        <p
          className={styles.description}
          style={{ opacity: isPaletteStrategyDisabled ? 0.5 : 1 }}
        >
          <Trans>
            Choisissez la stratégie de génération de palette pour optimiser la
            qualité visuelle.
          </Trans>
        </p>

        <PaletteStrategySelector />
      </div>

      <div className={styles.separator} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Configuration du Dithering</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            Sélectionnez l'algorithme de dithering et ajustez les paramètres
            pour optimiser le rendu final.
          </Trans>
        </p>

        <DitheringControls />
      </div>

      {!rasterEnabled && (
        <>
          <div className={styles.separator} />

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Trans>Lissage horizontal</Trans>
            </h3>
            <p className={styles.description}>
              <Trans>
                Applique un lissage horizontal pour réduire les artefacts de
                pixels. Désactivé en mode raster.
              </Trans>
            </p>

            <Flex direction='row' gap='0.5rem' align='center'>
              <Switch
                checked={horizontalSmoothing}
                onCheckedChange={onHorizontalSmoothingChange}
                id={smoothingId}
              />
              <label htmlFor={smoothingId} className={styles.switchLabel}>
                <Trans>Activer le lissage horizontal</Trans>
              </label>
            </Flex>
          </div>
        </>
      )}
    </>
  )
}
