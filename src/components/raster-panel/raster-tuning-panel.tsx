/**
 * Development-only raster tuning panel component
 */

import { Trans } from '@lingui/macro'
import { useAtom, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { autoOptimizeRasterAtom } from '@/app/store/raster/raster'
import {
  horizontalErrorCoefficientAtom,
  rasterTuningEnabledAtom,
  verticalErrorCoefficientAtom
} from '@/app/store/raster/raster-tuning'
import DraggableDialog from '@/components/ui/draggable-dialog'
import Icon from '@/components/ui/icon'
import PixsaurSlider from '@/components/ui/slider/slider'
import { isDevelopment } from '@/core'
import { rasterTuningOverrides } from '@/libs/pixsaur-raster/optimize-line-palettes'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  VERTICAL_ERROR_COEFFICIENT
} from '@/libs/pixsaur-raster/raster-constants'
import styles from './raster-tuning-panel.module.css'

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

export function RasterTuningPanel() {
  const [enabled, setEnabled] = useAtom(rasterTuningEnabledAtom)
  const autoOptimize = useSetAtom(autoOptimizeRasterAtom)

  const [verticalErrorCoef, setVerticalErrorCoef] = useAtom(
    verticalErrorCoefficientAtom
  )
  const [horizontalErrorCoef, setHorizontalErrorCoef] = useAtom(
    horizontalErrorCoefficientAtom
  )

  // Sync atom values to rasterTuningOverrides
  useEffect(() => {
    rasterTuningOverrides.verticalErrorCoefficient = verticalErrorCoef
    rasterTuningOverrides.horizontalErrorCoefficient = horizontalErrorCoef
  }, [verticalErrorCoef, horizontalErrorCoef])

  const handleReOptimize = async () => {
    await autoOptimize({ resetChanges: true })
  }

  // Only show in development
  if (!isDevelopment()) {
    return null
  }

  return (
    <DraggableDialog
      open={enabled}
      onOpenChange={setEnabled}
      title={
        <>
          <Icon name='GearIcon' /> <Trans>Raster Tuning (Dev)</Trans>
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

        <button
          type='button'
          className={styles.reoptimizeButton}
          onClick={handleReOptimize}
        >
          <Trans>Re-optimize with new values</Trans>
        </button>
      </div>
    </DraggableDialog>
  )
}
