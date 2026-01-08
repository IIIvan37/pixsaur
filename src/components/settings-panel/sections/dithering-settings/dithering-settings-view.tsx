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
  autoDistinctMapping: boolean
  onAutoDistinctMappingChange: (value: boolean) => void
  showDistinctMapping: boolean
  isDistinctMappingActive: boolean
  rasterEnabled: boolean
  isPaletteStrategyDisabled: boolean
}>

export function DitheringSettingsView({
  horizontalSmoothing,
  onHorizontalSmoothingChange,
  autoDistinctMapping,
  onAutoDistinctMappingChange,
  showDistinctMapping,
  isDistinctMappingActive,
  rasterEnabled,
  isPaletteStrategyDisabled
}: DitheringSettingsViewProps) {
  const smoothingId = useId()
  const distinctMappingId = useId()

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

      <div
        className={styles.section}
        style={{ opacity: isDistinctMappingActive ? 0.5 : 1 }}
      >
        <h3 className={styles.sectionTitle}>
          <Trans>Configuration du Dithering</Trans>
        </h3>
        <p className={styles.description}>
          {isDistinctMappingActive ? (
            <Trans>
              Désactivé quand le mapping distinct est actif pour préserver les
              couleurs exactes.
            </Trans>
          ) : (
            <Trans>
              Sélectionnez l'algorithme de dithering et ajustez les paramètres
              pour optimiser le rendu final.
            </Trans>
          )}
        </p>

        <DitheringControls disabled={isDistinctMappingActive} />
      </div>

      {!rasterEnabled && (
        <>
          {showDistinctMapping && (
            <>
              <div className={styles.separator} />

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Trans>Images retro (low-color)</Trans>
                </h3>
                <p className={styles.description}>
                  <Trans>
                    Détecte automatiquement les images avec peu de couleurs
                    (C64, ZX Spectrum, etc.) et préserve toutes les couleurs
                    distinctes.
                  </Trans>
                </p>

                <Flex direction='row' gap='0.5rem' align='center'>
                  <Switch
                    checked={autoDistinctMapping}
                    onCheckedChange={onAutoDistinctMappingChange}
                    id={distinctMappingId}
                  />
                  <label
                    htmlFor={distinctMappingId}
                    className={styles.switchLabel}
                  >
                    <Trans>Mapping distinct automatique</Trans>
                  </label>
                </Flex>
              </div>
            </>
          )}

          <div className={styles.separator} />

          <div
            className={styles.section}
            style={{ opacity: isDistinctMappingActive ? 0.5 : 1 }}
          >
            <h3 className={styles.sectionTitle}>
              <Trans>Lissage horizontal</Trans>
            </h3>
            <p className={styles.description}>
              {isDistinctMappingActive ? (
                <Trans>
                  Désactivé quand le mapping distinct est actif pour préserver
                  les couleurs exactes.
                </Trans>
              ) : (
                <Trans>
                  Applique un lissage horizontal pour réduire les artefacts de
                  pixels. Désactivé en mode raster.
                </Trans>
              )}
            </p>

            <Flex direction='row' gap='0.5rem' align='center'>
              <Switch
                checked={horizontalSmoothing && !isDistinctMappingActive}
                onCheckedChange={onHorizontalSmoothingChange}
                disabled={isDistinctMappingActive}
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
