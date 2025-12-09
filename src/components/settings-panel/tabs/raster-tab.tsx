/**
 * Raster tab content - extracted from RasterTuningPanel
 */

import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useId, useRef, useState } from 'react'
import { effectiveModeConfigAtom } from '@/app/store/config/config'
import { imageAtom } from '@/app/store/image/image'
import {
  autoOptimizeRasterAtom,
  hasGeneratedRastersAtom,
  rasterDitheringIntensityAtom,
  rasterEnabledAtom,
  rasterMaxChangesPerLineAtom
} from '@/app/store/raster/raster'
import {
  horizontalErrorCoefficientAtom,
  paletteContinuityBonusAtom,
  paletteContinuityDistanceAtom,
  paletteFrequencyExponentAtom,
  verticalErrorCoefficientAtom
} from '@/app/store/raster/raster-tuning'
import Button from '@/components/ui/button'
import Flex from '@/components/ui/flex'
import Icon from '@/components/ui/icon'
import PixsaurSlider from '@/components/ui/slider/slider'
import { Switch } from '@/components/ui/switch'
import logger from '@/core/logger'
import { rasterTuningOverrides } from '@/libs/pixsaur-raster/optimize-line-palettes'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  PALETTE_CONTINUITY_BONUS,
  PALETTE_CONTINUITY_DISTANCE,
  PALETTE_FREQUENCY_EXPONENT,
  VERTICAL_ERROR_COEFFICIENT
} from '@/libs/pixsaur-raster/raster-constants'
import styles from './tab.module.css'

interface TuningSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  defaultValue: number
  format?: (value: number) => string
  description?: string
}

function TuningSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  defaultValue,
  format = (v) => v.toFixed(2),
  description
}: TuningSliderProps) {
  return (
    <div className={styles.tuningRow}>
      <div className={styles.tuningHeader}>
        <span className={styles.tuningLabel}>{label}</span>
        <div className={styles.tuningValue}>
          <span className={styles.currentValue}>{format(value)}</span>
          {value !== defaultValue && (
            <button
              type='button'
              className={styles.resetButton}
              onClick={() => onChange(defaultValue)}
              title='Reset to default'
            >
              ↺
            </button>
          )}
        </div>
      </div>
      <PixsaurSlider
        min={min}
        max={max}
        value={value}
        step={step}
        onChange={onChange}
        hideLabel
        showTooltip={false}
      />
      {description && <div className={styles.description}>{description}</div>}
    </div>
  )
}

export function RasterTab() {
  const rasterEnabledId = useId()
  const autoOptimize = useSetAtom(autoOptimizeRasterAtom)
  const [rasterEnabled, setRasterEnabled] = useAtom(rasterEnabledAtom)
  const hasGeneratedRasters = useAtomValue(hasGeneratedRastersAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const image = useAtomValue(imageAtom)
  const [isOptimizing, setIsOptimizing] = useState(false)

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

  const isRegeneratingRef = useRef(false)

  useEffect(() => {
    if (isRegeneratingRef.current || !rasterEnabled || !hasGeneratedRasters) {
      rasterTuningOverrides.verticalErrorCoefficient = verticalErrorCoef
      rasterTuningOverrides.horizontalErrorCoefficient = horizontalErrorCoef
      rasterTuningOverrides.paletteContinuityDistance =
        paletteContinuityDistance
      rasterTuningOverrides.paletteContinuityBonus = paletteContinuityBonus
      rasterTuningOverrides.paletteFrequencyExponent = paletteFrequencyExponent
      return
    }

    rasterTuningOverrides.verticalErrorCoefficient = verticalErrorCoef
    rasterTuningOverrides.horizontalErrorCoefficient = horizontalErrorCoef
    rasterTuningOverrides.paletteContinuityDistance = paletteContinuityDistance
    rasterTuningOverrides.paletteContinuityBonus = paletteContinuityBonus
    rasterTuningOverrides.paletteFrequencyExponent = paletteFrequencyExponent

    isRegeneratingRef.current = true

    const timeoutId = setTimeout(() => {
      autoOptimize({ resetChanges: true })
        .catch((error) => {
          logger.error('Failed to regenerate rasters:', error)
        })
        .finally(() => {
          isRegeneratingRef.current = false
        })
    }, 200)

    return () => {
      clearTimeout(timeoutId)
      isRegeneratingRef.current = false
    }
  }, [
    verticalErrorCoef,
    horizontalErrorCoef,
    paletteContinuityDistance,
    paletteContinuityBonus,
    paletteFrequencyExponent,
    rasterEnabled,
    hasGeneratedRasters,
    autoOptimize
  ])

  // Calculate max allowed changes based on mode
  const maxAllowedChanges =
    modeConfig.mode === 0 ? 8 : modeConfig.mode === 1 ? 4 : 2

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
          label='Changements par ligne'
          value={Math.min(maxChangesPerLine, maxAllowedChanges)}
          onChange={setMaxChangesPerLine}
          min={1}
          max={maxAllowedChanges}
          step={1}
          defaultValue={1}
          format={(v) => v.toFixed(0)}
          description="Nombre maximum de changements d'encre par ligne (1 = raster classique)"
        />

        <TuningSlider
          label='Dithering raster'
          value={Math.round(rasterDitheringIntensity * 100)}
          onChange={(val) => setRasterDitheringIntensity(val / 100)}
          min={0}
          max={100}
          step={5}
          defaultValue={0}
          format={(v) => `${v}%`}
          description="Pré-traitement dithering 1D appliqué à l'image avant extraction des palettes"
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
          <Trans>Dithering Error Propagation</Trans>
        </h3>

        <TuningSlider
          label='Vertical Error Coefficient'
          value={verticalErrorCoef}
          onChange={setVerticalErrorCoef}
          min={0.0}
          max={0.5}
          step={0.025}
          defaultValue={VERTICAL_ERROR_COEFFICIENT}
          description='Propagation verticale des erreurs de quantification (lower = moins de banding)'
        />

        <TuningSlider
          label='Horizontal Error Coefficient'
          value={horizontalErrorCoef}
          onChange={setHorizontalErrorCoef}
          min={0.0}
          max={1.0}
          step={0.05}
          defaultValue={HORIZONTAL_ERROR_COEFFICIENT}
          description='Propagation horizontale des erreurs de quantification entre pixels'
        />
      </div>

      <div className={styles.separator} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Palette Selection</Trans>
        </h3>

        <TuningSlider
          label='Continuity Distance'
          value={paletteContinuityDistance}
          onChange={setPaletteContinuityDistance}
          min={200}
          max={2000}
          step={50}
          defaultValue={PALETTE_CONTINUITY_DISTANCE}
          format={(v) => v.toFixed(0)}
          description='Lower = more palette changes, higher = more stability'
        />

        <TuningSlider
          label='Continuity Bonus'
          value={paletteContinuityBonus}
          onChange={setPaletteContinuityBonus}
          min={1.0}
          max={3.0}
          step={0.1}
          defaultValue={PALETTE_CONTINUITY_BONUS}
          description='Higher = stronger preference for previous palette colors'
        />

        <TuningSlider
          label='Frequency Weight'
          value={paletteFrequencyExponent}
          onChange={setPaletteFrequencyExponent}
          min={0.0}
          max={1.0}
          step={0.05}
          defaultValue={PALETTE_FREQUENCY_EXPONENT}
          description='0 = pure diversity, 0.5 = balanced, 1 = prefer frequent colors'
        />
      </div>
    </div>
  )
}
