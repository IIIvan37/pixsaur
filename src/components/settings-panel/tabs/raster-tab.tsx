/**
 * Raster tab content - extracted from RasterTuningPanel
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useId, useRef, useState } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom
} from '@/app/store/config/config'
import { imageAtom } from '@/app/store/image/image'
import { displayPaletteAtom } from '@/app/store/preview/preview'
import {
  addRasterChangeAtom,
  autoOptimizeRasterAtom,
  clearRasterChangesAtom,
  hasGeneratedRastersAtom,
  rasterChangesAtom,
  rasterConflictsAtom,
  rasterDitheringIntensityAtom,
  rasterEnabledAtom,
  rasterMaxChangesPerLineAtom,
  removeRasterChangeAtom,
  updateRasterChangeAtom
} from '@/app/store/raster/raster'
import {
  horizontalErrorCoefficientAtom,
  paletteContinuityBonusAtom,
  paletteContinuityDistanceAtom,
  paletteFrequencyExponentAtom,
  verticalErrorCoefficientAtom
} from '@/app/store/raster/raster-tuning'
import { useAutoRegenerateRasters } from '@/app/store/raster/use-auto-regenerate-rasters'
import { useRasterTuningRegeneration } from '@/app/store/raster/use-raster-tuning-regeneration'
import { RasterPanelView } from '@/components/raster-panel/raster-panel-view'
import { TuningSlider } from '@/components/settings-panel/shared/tuning-slider'
import Button from '@/components/ui/button'
import Flex from '@/components/ui/flex'
import Icon from '@/components/ui/icon'
import { Switch } from '@/components/ui/switch'
import logger from '@/core/logger'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  PALETTE_CONTINUITY_BONUS,
  PALETTE_CONTINUITY_DISTANCE,
  PALETTE_FREQUENCY_EXPONENT,
  VERTICAL_ERROR_COEFFICIENT
} from '@/libs/pixsaur-raster/raster-constants'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { cpcFullPalette } from '@/palettes/cpc-palette'
import styles from './tab.module.css'

export function RasterTab() {
  const { _ } = useLingui()
  const rasterEnabledId = useId()
  const autoOptimize = useSetAtom(autoOptimizeRasterAtom)
  const [rasterEnabled, setRasterEnabled] = useAtom(rasterEnabledAtom)
  const hasGeneratedRasters = useAtomValue(hasGeneratedRastersAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const image = useAtomValue(imageAtom)
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Raster panel state
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const changes = useAtomValue(rasterChangesAtom)
  const conflicts = useAtomValue(rasterConflictsAtom)
  const displayPalette = useAtomValue(displayPaletteAtom)
  const addChange = useSetAtom(addRasterChangeAtom)
  const updateChange = useSetAtom(updateRasterChangeAtom)
  const removeChange = useSetAtom(removeRasterChangeAtom)
  const clearAllChanges = useSetAtom(clearRasterChangesAtom)

  const handleAutoOptimize = async () => {
    setIsOptimizing(true)
    try {
      await autoOptimize({ resetChanges: true })
    } catch (error) {
      logger.error('Failed to generate rasters:', error)
    } finally {
      setIsOptimizing(false)
    }
  }

  const [rasterDitheringIntensity, setRasterDitheringIntensity] = useAtom(
    rasterDitheringIntensityAtom
  )
  const [maxChangesPerLine, setMaxChangesPerLine] = useAtom(
    rasterMaxChangesPerLineAtom
  )

  const [verticalErrorCoef, setVerticalErrorCoef] = useAtom(
    verticalErrorCoefficientAtom
  )
  const [horizontalErrorCoef, setHorizontalErrorCoef] = useAtom(
    horizontalErrorCoefficientAtom
  )

  const [paletteContinuityDistance, setPaletteContinuityDistance] = useAtom(
    paletteContinuityDistanceAtom
  )
  const [paletteContinuityBonus, setPaletteContinuityBonus] = useAtom(
    paletteContinuityBonusAtom
  )
  const [paletteFrequencyExponent, setPaletteFrequencyExponent] = useAtom(
    paletteFrequencyExponentAtom
  )

  // Auto-regenerate rasters when parameters change
  useAutoRegenerateRasters()

  // Auto-regenerate rasters when tuning parameters change
  useRasterTuningRegeneration()

  const previousHardwareRef = useRef(cpcHardware)
  const previousModeRef = useRef(modeConfig.nColors)

  // Watch for hardware (classic/plus) or mode (0/1/2) changes and clear rasters
  useEffect(() => {
    const hardwareChanged = previousHardwareRef.current !== cpcHardware
    const modeChanged = previousModeRef.current !== modeConfig.nColors

    previousHardwareRef.current = cpcHardware
    previousModeRef.current = modeConfig.nColors

    if ((!hardwareChanged && !modeChanged) || !rasterEnabled) {
      return
    }

    clearAllChanges()
  }, [cpcHardware, modeConfig.nColors, rasterEnabled, clearAllChanges])

  // Raster panel helper variables
  const maxLine = modeConfig.height - 1
  const isClassicMode = cpcHardware === 'classic'
  const isPlusMode = cpcHardware === 'plus'
  const hardwareLimit = cpcHardware === 'classic' ? 2 : 4
  const effectiveMaxChanges = Math.min(maxChangesPerLine, hardwareLimit)
  const palette: Vector[] = displayPalette.map(
    (slot) => slot.color || ([0, 0, 0] as Vector)
  )

  // Raster panel handlers
  const handleAddChange = () => {
    const lastChange = changes.at(-1)

    if (lastChange) {
      const changesOnLastLine = changes.filter(
        (c) => c.line === lastChange.line
      )
      const usedInks = new Set(changesOnLastLine.map((c) => c.inkIndex))

      if (changesOnLastLine.length < effectiveMaxChanges) {
        const availableInks = Array.from(
          { length: modeConfig.nColors },
          (_, i) => i
        )
        const nextInk = availableInks.find((ink) => !usedInks.has(ink)) ?? 0
        const defaultColor = palette[nextInk] || [0, 0, 0]

        addChange({
          line: lastChange.line,
          inkIndex: nextInk,
          color: defaultColor as Vector<'RGB'>
        })
        return
      }
    }

    const defaultLine = lastChange ? Math.min(lastChange.line + 1, maxLine) : 0
    const defaultInkIndex = 0
    const defaultColor = palette[defaultInkIndex] || [0, 0, 0]

    addChange({
      line: defaultLine,
      inkIndex: defaultInkIndex,
      color: defaultColor as Vector<'RGB'>
    })
  }

  const handleUpdateChange = (
    id: string,
    field: keyof Omit<RasterChange, 'id'>,
    value: number | Vector<'RGB'>
  ) => {
    if (field === 'inkIndex') {
      const change = changes.find((c) => c.id === id)
      if (!change) return

      const newInkIndex = value as number
      if (newInkIndex === change.inkIndex) {
        updateChange({ id, inkIndex: value as number })
        return
      }

      const otherChangesOnLine = changes.filter(
        (c) => c.line === change.line && c.id !== id
      )
      const usedInks = new Set(otherChangesOnLine.map((c) => c.inkIndex))

      if (usedInks.has(newInkIndex)) {
        updateChange({ id, inkIndex: value as number })
        return
      }

      if (usedInks.size + 1 > effectiveMaxChanges) {
        return
      }
    }

    updateChange({ id, [field]: value })
  }

  const handleRemoveChange = (id: string) => {
    removeChange(id)
  }

  return (
    <div className={styles.tabContent}>
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
            onCheckedChange={setRasterEnabled}
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
          onChange={setMaxChangesPerLine}
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
          onChange={(val) => setRasterDitheringIntensity(val / 100)}
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

        {image && (
          <Button
            variant='secondary'
            onClick={handleAutoOptimize}
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
          onChange={setVerticalErrorCoef}
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
          onChange={setHorizontalErrorCoef}
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
          onChange={setPaletteContinuityDistance}
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
          onChange={setPaletteContinuityBonus}
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
          onChange={setPaletteFrequencyExponent}
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
              nColors={modeConfig.nColors}
              maxChangesPerLine={effectiveMaxChanges}
              cpcPalette={cpcFullPalette}
              isClassicMode={isClassicMode}
              isPlusMode={isPlusMode}
              onAddChange={handleAddChange}
              onUpdateChange={handleUpdateChange}
              onRemoveChange={handleRemoveChange}
              onClearAll={clearAllChanges}
            />
          </div>
        </>
      )}
    </div>
  )
}
