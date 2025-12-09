/**
 * Dithering tab - Dithering algorithm and settings
 */

import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import { useId } from 'react'
import { horizontalSmoothingAtom } from '@/app/store/config/config'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import {
  PaletteStrategySelector,
  usePaletteStrategyDisabled
} from '@/components/image-controls/palette-strategy-selector/palette-strategy-selector'
import Flex from '@/components/ui/flex'
import { Switch } from '@/components/ui/switch'
import { DitheringControls } from './dithering-controls'
import styles from './tab.module.css'

export function DitheringTab() {
  const smoothingId = useId()
  const [horizontalSmoothing, setHorizontalSmoothing] = useAtom(
    horizontalSmoothingAtom
  )
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const isPaletteStrategyDisabled = usePaletteStrategyDisabled()

  return (
    <div className={styles.tabContent}>
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
                onCheckedChange={setHorizontalSmoothing}
                id={smoothingId}
              />
              <label htmlFor={smoothingId} className={styles.switchLabel}>
                <Trans>Activer le lissage horizontal</Trans>
              </label>
            </Flex>
          </div>
        </>
      )}
    </div>
  )
}
