/**
 * Raster settings view (dumb component)
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useId } from 'react'
import { RasterPanelView } from '@/components/raster-panel/raster-panel-view'
import { TuningSlider } from '@/components/settings-panel/shared/tuning-slider'
import Button from '@/components/ui/button'
import Flex from '@/components/ui/flex'
import Icon from '@/components/ui/icon'
import { Switch } from '@/components/ui/switch'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  PALETTE_CONTINUITY_BONUS,
  PALETTE_CONTINUITY_DISTANCE,
  PALETTE_FREQUENCY_EXPONENT,
  VERTICAL_ERROR_COEFFICIENT
} from '@/libs/pixsaur-raster/raster-constants'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { CPCColor } from '@/libs/types'
import styles from '../../tabs/tab.module.css'

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

  // Palette selection
  paletteContinuityDistance: number
  onPaletteContinuityDistanceChange: (value: number) => void
  paletteContinuityBonus: number
  onPaletteContinuityBonusChange: (value: number) => void
  paletteFrequencyExponent: number
  onPaletteFrequencyExponentChange: (value: number) => void

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
  paletteContinuityDistance,
  onPaletteContinuityDistanceChange,
  paletteContinuityBonus,
  onPaletteContinuityBonusChange,
  paletteFrequencyExponent,
  onPaletteFrequencyExponentChange,
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

      <div className={styles.separator} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Sélection de palette</Trans>
        </h3>

        <TuningSlider
          label={_(msg`Distance de continuité`)}
          value={paletteContinuityDistance}
          onChange={onPaletteContinuityDistanceChange}
          min={200}
          max={2000}
          step={50}
          defaultValue={PALETTE_CONTINUITY_DISTANCE}
          format={(v) => v.toFixed(0)}
          description={_(
            msg`Plus bas = plus de changements de palette, plus haut = plus de stabilité`
          )}
          resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
        />

        <TuningSlider
          label={_(msg`Bonus de continuité`)}
          value={paletteContinuityBonus}
          onChange={onPaletteContinuityBonusChange}
          min={1}
          max={3}
          step={0.1}
          defaultValue={PALETTE_CONTINUITY_BONUS}
          description={_(
            msg`Plus haut = préférence plus forte pour les couleurs de la palette précédente`
          )}
          resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
        />

        <TuningSlider
          label={_(msg`Poids de fréquence`)}
          value={paletteFrequencyExponent}
          onChange={onPaletteFrequencyExponentChange}
          min={0}
          max={1}
          step={0.05}
          defaultValue={PALETTE_FREQUENCY_EXPONENT}
          description={_(
            msg`0 = diversité pure, 0.5 = équilibré, 1 = préférer les couleurs fréquentes`
          )}
          resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
        />
      </div>

      {rasterEnabled && changes.length > 0 && (
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
