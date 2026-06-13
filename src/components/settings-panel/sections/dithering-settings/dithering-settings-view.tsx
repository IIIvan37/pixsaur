/**
 * Dithering settings view (dumb component)
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useId } from 'react'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import Flex from '@/components/ui/flex'
import Icon from '@/components/ui/icon'
import { Switch } from '@/components/ui/switch'
import { Tooltip } from '@/components/ui/tooltip/tooltip'
import { TuningSlider } from '../../shared/tuning-slider'
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
  isDistinctMappingDisabled: boolean
  sourceUniqueColors: number | null
  rasterEnabled: boolean
  isPaletteStrategyDisabled: boolean
  showColorDiversity: boolean
  colorDiversity: number
  onColorDiversityChange: (value: number) => void
}>

export function DitheringSettingsView({
  horizontalSmoothing,
  onHorizontalSmoothingChange,
  autoDistinctMapping,
  onAutoDistinctMappingChange,
  showDistinctMapping,
  isDistinctMappingActive,
  isDistinctMappingDisabled,
  sourceUniqueColors,
  rasterEnabled,
  isPaletteStrategyDisabled,
  showColorDiversity,
  colorDiversity,
  onColorDiversityChange
}: DitheringSettingsViewProps) {
  const smoothingId = useId()
  const distinctMappingId = useId()
  const { _ } = useLingui()

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

      {showColorDiversity && (
        <>
          <div className={styles.separator} />

          <CollapsibleSection
            title={
              <Flex align='center' gap='0.375rem'>
                <Trans>Diversité des couleurs</Trans>
                <Tooltip
                  content={_(
                    msg`Montez la valeur pour des images riches en teintes variées ; baissez-la pour mieux préserver les dégradés et nuances proches.`
                  )}
                >
                  <Icon name='QuestionMarkCircledIcon' />
                </Tooltip>
              </Flex>
            }
            defaultOpen={false}
          >
            <p className={styles.description}>
              <Trans>
                Ajustez l'équilibre entre fidélité aux couleurs fréquentes et
                variété des teintes (CPC Plus Mode 0).
              </Trans>
            </p>

            <TuningSlider
              min={0}
              max={100}
              step={1}
              value={colorDiversity}
              defaultValue={50}
              onChange={onColorDiversityChange}
              label={_(
                msg({
                  id: 'color.diversity.label',
                  message: 'Diversité'
                })
              )}
              description={_(
                msg({
                  id: 'color.diversity.description',
                  message: 'Nuances similaires (0) ◄► Teintes distinctes (100)'
                })
              )}
              format={(v) => `${v}`}
              resetTitle={_(
                msg({
                  id: 'color.diversity.reset',
                  message: 'Réinitialiser à 50'
                })
              )}
            />
          </CollapsibleSection>
        </>
      )}

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

              <CollapsibleSection
                title={<Trans>Images retro (low-color)</Trans>}
                defaultOpen={false}
              >
                <div style={{ opacity: isDistinctMappingDisabled ? 0.5 : 1 }}>
                  <p className={styles.description}>
                    {isDistinctMappingDisabled ? (
                      <Trans>
                        Non disponible : l'image source a plus de 16 couleurs
                        uniques ({sourceUniqueColors ?? '?'}+).
                      </Trans>
                    ) : (
                      <Trans>
                        Détecte automatiquement les images avec peu de couleurs
                        (C64, ZX Spectrum, etc.) et préserve toutes les couleurs
                        distinctes.
                      </Trans>
                    )}
                  </p>

                  <Flex direction='row' gap='0.5rem' align='center'>
                    <Switch
                      checked={
                        autoDistinctMapping && !isDistinctMappingDisabled
                      }
                      onCheckedChange={onAutoDistinctMappingChange}
                      disabled={isDistinctMappingDisabled}
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
              </CollapsibleSection>
            </>
          )}

          <div className={styles.separator} />

          <CollapsibleSection
            title={<Trans>Lissage horizontal</Trans>}
            defaultOpen={false}
          >
            <div style={{ opacity: isDistinctMappingActive ? 0.5 : 1 }}>
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
          </CollapsibleSection>
        </>
      )}
    </>
  )
}
