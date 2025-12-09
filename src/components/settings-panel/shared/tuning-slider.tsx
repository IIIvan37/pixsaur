/**
 * Reusable slider component for tuning parameters with reset button
 */

import PixsaurSlider from '@/components/ui/slider/slider'
import styles from '../tabs/tab.module.css'

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
  resetTitle?: string
}

export function TuningSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  defaultValue,
  format = (v) => v.toFixed(2),
  description,
  resetTitle = 'Reset to default'
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
              title={resetTitle}
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
