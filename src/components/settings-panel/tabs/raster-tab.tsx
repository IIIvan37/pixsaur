/**
 * Raster tab content - extracted from RasterTuningPanel
 */

import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import {
  autoOptimizeRasterAtom,
  hasGeneratedRastersAtom,
  rasterEnabledAtom
} from '@/app/store/raster/raster'
import {
  horizontalErrorCoefficientAtom,
  paletteContinuityBonusAtom,
  paletteContinuityDistanceAtom,
  paletteFrequencyExponentAtom,
  verticalErrorCoefficientAtom
} from '@/app/store/raster/raster-tuning'
import PixsaurSlider from '@/components/ui/slider/slider'
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
  const autoOptimize = useSetAtom(autoOptimizeRasterAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const hasGeneratedRasters = useAtomValue(hasGeneratedRastersAtom)

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

  return (
    <div className={styles.tabContent}>
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
          description='Lower = less vertical banding'
        />

        <TuningSlider
          label='Horizontal Error Coefficient'
          value={horizontalErrorCoef}
          onChange={setHorizontalErrorCoef}
          min={0.0}
          max={1.0}
          step={0.05}
          defaultValue={HORIZONTAL_ERROR_COEFFICIENT}
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
