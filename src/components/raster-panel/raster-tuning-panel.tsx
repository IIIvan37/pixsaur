/**
 * Raster tuning panel component
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
  rasterTuningEnabledAtom,
  verticalErrorCoefficientAtom
} from '@/app/store/raster/raster-tuning'
import DraggableDialog from '@/components/ui/draggable-dialog'
import Icon from '@/components/ui/icon'
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
import styles from './raster-tuning-panel.module.css'

interface TuningSliderProps {
  readonly label: string
  readonly value: number
  readonly onChange: (value: number) => void
  readonly min: number
  readonly max: number
  readonly step: number
  readonly defaultValue: number
  readonly format?: (value: number) => string
  readonly description?: string
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

export function RasterTuningPanel() {
  const [enabled, setEnabled] = useAtom(rasterTuningEnabledAtom)
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

  // Ref to prevent re-triggering during regeneration
  const isRegeneratingRef = useRef(false)

  // Sync atom values to rasterTuningOverrides and re-optimize automatically
  useEffect(() => {
    // Skip if already regenerating or if rasters aren't enabled/generated
    if (isRegeneratingRef.current || !rasterEnabled || !hasGeneratedRasters) {
      // Still update the overrides even if we don't regenerate
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

    // Set flag to prevent re-triggering
    isRegeneratingRef.current = true

    // Debounce the regeneration (200ms) to avoid too many updates
    const timeoutId = setTimeout(() => {
      // Auto-regenerate with new values
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
    <DraggableDialog
      open={enabled}
      onOpenChange={setEnabled}
      title={
        <>
          <Icon name='GearIcon' /> <Trans>Raster Tuning</Trans>
        </>
      }
      defaultPosition={{ x: 120, y: 80 }}
    >
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Trans>Dithering Error Propagation</Trans>
          </h3>

          <TuningSlider
            label='Vertical Error Coefficient'
            value={verticalErrorCoef}
            onChange={setVerticalErrorCoef}
            min={0}
            max={0.5}
            step={0.025}
            defaultValue={VERTICAL_ERROR_COEFFICIENT}
            description='Lower = less vertical banding'
          />

          <TuningSlider
            label='Horizontal Error Coefficient'
            value={horizontalErrorCoef}
            onChange={setHorizontalErrorCoef}
            min={0}
            max={1}
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
            min={1}
            max={3}
            step={0.1}
            defaultValue={PALETTE_CONTINUITY_BONUS}
            description='Higher = stronger preference for previous palette colors'
          />

          <TuningSlider
            label='Frequency Weight'
            value={paletteFrequencyExponent}
            onChange={setPaletteFrequencyExponent}
            min={0}
            max={1}
            step={0.05}
            defaultValue={PALETTE_FREQUENCY_EXPONENT}
            description='0 = pure diversity, 0.5 = balanced, 1 = prefer frequent colors'
          />
        </div>
      </div>
    </DraggableDialog>
  )
}
