/**
 * Raster settings view (dumb component)
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useId } from 'react'
import { TuningSlider } from '@/components/settings-panel/shared/tuning-slider'
import Button from '@/components/ui/button'
import Flex from '@/components/ui/flex'
import Icon from '@/components/ui/icon'
import { Switch } from '@/components/ui/switch'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  PREPROCESS_CONTINUITY_BONUS,
  PREPROCESS_CONTINUITY_DISTANCE,
  PREPROCESS_FREQUENCY_EXPONENT,
  VERTICAL_ERROR_COEFFICIENT
} from '@/libs/pixsaur-raster/raster-constants'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { CPCColor } from '@/libs/types'
import styles from '../../tabs/tab.module.css'
import { RasterPanelView } from './raster-panel-view'

type RasterSettingsViewProps = {
  // Raster mode
  rasterEnabled: boolean
  onRasterEnabledChange: (value: boolean) => void

  // Raster parameters
  maxChangesPerLine: number
  onMaxChangesPerLineChange: (value: number) => void
  hardwareLimit: number
  rasterDitheringIntensity: number
  onRasterDitheringIntensityChange: (value: number) => void

  // Auto optimize
  hasImage: boolean
  isOptimizing: boolean
  hasGeneratedRasters: boolean
  onAutoOptimize: () => void

  // Error propagation
  verticalErrorCoef: number
  onVerticalErrorCoefChange: (value: number) => void
  horizontalErrorCoef: number
  onHorizontalErrorCoefChange: (value: number) => void

  // Preprocessing parameters (base palette extraction)
  // Only shown for modes with few colors (Mode 1, Mode 2) where selection algorithm applies
  showPreprocessParams: boolean
  preprocessContinuityDistance: number
  onPreprocessContinuityDistanceChange: (value: number) => void
  preprocessContinuityBonus: number
  onPreprocessContinuityBonusChange: (value: number) => void
  preprocessFrequencyExponent: number
  onPreprocessFrequencyExponentChange: (value: number) => void

  // Raster panel
  changes: RasterChange[]
  conflicts: string[]
  maxLine: number
  palette: Vector[]
  nColors: number
  cpcPalette: CPCColor[]
  isClassicMode: boolean
  isPlusMode: boolean
  onAddChange: () => void
  onUpdateChange: (
    id: string,
    field: keyof Omit<RasterChange, 'id'>,
    value: number | Vector<'RGB'>
  ) => void
  onRemoveChange: (id: string) => void
  onClearAll: () => void
}

export function RasterSettingsView({
  rasterEnabled,
  onRasterEnabledChange,
  maxChangesPerLine,
  onMaxChangesPerLineChange,
  hardwareLimit,
  rasterDitheringIntensity,
  onRasterDitheringIntensityChange,
  hasImage,
  isOptimizing,
  hasGeneratedRasters,
  onAutoOptimize,
  verticalErrorCoef,
  onVerticalErrorCoefChange,
  horizontalErrorCoef,
  onHorizontalErrorCoefChange,
  showPreprocessParams,
  preprocessContinuityDistance,
  onPreprocessContinuityDistanceChange,
  preprocessContinuityBonus,
  onPreprocessContinuityBonusChange,
  preprocessFrequencyExponent,
  onPreprocessFrequencyExponentChange,
  changes,
  conflicts,
  maxLine,
  palette,
  nColors,
  cpcPalette,
  isClassicMode,
  isPlusMode,
  onAddChange,
  onUpdateChange,
  onRemoveChange,
  onClearAll
}: RasterSettingsViewProps) {
  const { _ } = useLingui()
  const rasterEnabledId = useId()
  const effectiveMaxChanges = Math.min(maxChangesPerLine, hardwareLimit)

  return (
    <>
      {/* Switch Mode Raster */}
      <div className={styles.section}>
        <Flex align='center' justify='space-between' style={{ width: '100%' }}>
          <div>
            <h3 className={styles.sectionTitle}>
              <Trans>Mode Raster</Trans>
            </h3>
            <p className={styles.description}>
              <Trans>
                Active le mode raster pour utiliser des palettes optimisées par
                ligne.
              </Trans>
            </p>
          </div>
          <Switch
            checked={rasterEnabled}
            onCheckedChange={onRasterEnabledChange}
            id={rasterEnabledId}
          />
        </Flex>
      </div>

      <div className={styles.separator} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Paramètres Raster</Trans>
        </h3>

        <TuningSlider
          label={_(msg`Changements par ligne`)}
          value={Math.min(maxChangesPerLine, hardwareLimit)}
          onChange={onMaxChangesPerLineChange}
          min={1}
          max={hardwareLimit}
          step={1}
          defaultValue={1}
          format={(v) => v.toFixed(0)}
          description={_(
            msg`Nombre maximum de changements d'encre par ligne (1 = raster classique)`
          )}
          resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
        />

        <TuningSlider
          label={_(msg`Dithering raster`)}
          value={Math.round(rasterDitheringIntensity * 100)}
          onChange={(val) => onRasterDitheringIntensityChange(val / 100)}
          min={0}
          max={100}
          step={5}
          defaultValue={0}
          format={(v) => `${v}%`}
          description={_(
            msg`Pré-traitement dithering 1D appliqué à l'image avant extraction des palettes`
          )}
          resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
        />

        {hasImage && (
          <Button
            variant='secondary'
            onClick={onAutoOptimize}
            disabled={isOptimizing || hasGeneratedRasters}
            style={{ marginTop: 'var(--spacing-md)', width: '100%' }}
          >
            <Icon name='GearIcon' />
            {isOptimizing ? (
              <Trans>Optimisation...</Trans>
            ) : hasGeneratedRasters ? (
              <Trans>Rasters générés</Trans>
            ) : (
              <Trans>Générer les rasters</Trans>
            )}
          </Button>
        )}
      </div>

      <div className={styles.separator} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Propagation d'erreur de dithering</Trans>
        </h3>

        <TuningSlider
          label={_(msg`Coefficient d'erreur verticale`)}
          value={verticalErrorCoef}
          onChange={onVerticalErrorCoefChange}
          min={0}
          max={0.5}
          step={0.025}
          defaultValue={VERTICAL_ERROR_COEFFICIENT}
          description={_(
            msg`Propagation verticale des erreurs de quantification (lower = moins de banding)`
          )}
          resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
        />

        <TuningSlider
          label={_(msg`Coefficient d'erreur horizontale`)}
          value={horizontalErrorCoef}
          onChange={onHorizontalErrorCoefChange}
          min={0}
          max={1}
          step={0.05}
          defaultValue={HORIZONTAL_ERROR_COEFFICIENT}
          description={_(
            msg`Propagation horizontale des erreurs de quantification entre pixels`
          )}
          resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
        />
      </div>

      {/* Preprocessing parameters - only useful for Mode 1 (4 colors) and Mode 2 (2 colors) */}
      {/* In Mode 0 (16 colors), lines rarely have >16 unique colors so selection algorithm doesn't apply */}
      {showPreprocessParams && (
        <>
          <div className={styles.separator} />

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Trans>Extraction palette de base</Trans>
            </h3>
            <p className={styles.description}>
              <Trans>
                Paramètres pour l'extraction de la palette initiale depuis
                l'image source.
              </Trans>
            </p>

            <TuningSlider
              label={_(msg`Distance de continuité`)}
              value={preprocessContinuityDistance}
              onChange={onPreprocessContinuityDistanceChange}
              min={200}
              max={2000}
              step={50}
              defaultValue={PREPROCESS_CONTINUITY_DISTANCE}
              format={(v) => v.toFixed(0)}
              description={_(
                msg`Plus bas = plus de variété, plus haut = plus de cohérence entre lignes`
              )}
              resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
            />

            <TuningSlider
              label={_(msg`Bonus de continuité`)}
              value={preprocessContinuityBonus}
              onChange={onPreprocessContinuityBonusChange}
              min={1}
              max={3}
              step={0.1}
              defaultValue={PREPROCESS_CONTINUITY_BONUS}
              description={_(
                msg`Plus haut = préférence pour les couleurs similaires aux lignes précédentes`
              )}
              resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
            />

            <TuningSlider
              label={_(msg`Poids de fréquence`)}
              value={preprocessFrequencyExponent}
              onChange={onPreprocessFrequencyExponentChange}
              min={0}
              max={1}
              step={0.05}
              defaultValue={PREPROCESS_FREQUENCY_EXPONENT}
              description={_(
                msg`0 = diversité pure, 0.5 = équilibré, 1 = préférer les couleurs fréquentes`
              )}
              resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
            />
          </div>
        </>
      )}

      {rasterEnabled && (
        <>
          <div className={styles.separator} />

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Trans>Changements Raster</Trans>
            </h3>
            <p className={styles.description}>
              <Trans>
                Gestion des changements d'encre par ligne (générés
                automatiquement ou manuels)
              </Trans>
            </p>

            <RasterPanelView
              enabled={rasterEnabled}
              changes={changes}
              conflicts={conflicts}
              maxLine={maxLine}
              palette={palette}
              nColors={nColors}
              maxChangesPerLine={effectiveMaxChanges}
              cpcPalette={cpcPalette}
              isClassicMode={isClassicMode}
              isPlusMode={isPlusMode}
              onAddChange={onAddChange}
              onUpdateChange={onUpdateChange}
              onRemoveChange={onRemoveChange}
              onClearAll={onClearAll}
            />
          </div>
        </>
      )}
    </>
  )
}
