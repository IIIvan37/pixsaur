import * as Slider from '@radix-ui/react-slider'
import clsx from 'clsx'
import { type ReactNode, useEffect, useState } from 'react'
import styles from './slider.module.css'

type PixsaurSliderProps = {
  min: number
  max: number
  value: number
  step?: number
  onChange: (val: number) => void
  label?: ReactNode
  description?: ReactNode
  hideLabel?: boolean
  disabled?: boolean
  showTooltip?: boolean
}

export default function PixsaurSlider({
  min,
  max,
  value,
  step = 1,
  onChange,
  label,
  description,
  hideLabel = false,
  disabled = false,
  showTooltip = true
}: Readonly<PixsaurSliderProps>) {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [descTooltipVisible, setDescTooltipVisible] = useState(false)
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    const p = ((value - min) / (max - min)) * 100
    setPercent(p)
  }, [value, min, max])

  return (
    <div className={clsx(styles.container, disabled && styles.disabled)}>
      {!hideLabel && label && (
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          {description && (
            <button
              type="button"
              className={styles.infoIcon}
              onMouseEnter={() => setDescTooltipVisible(true)}
              onMouseLeave={() => setDescTooltipVisible(false)}
              onFocus={() => setDescTooltipVisible(true)}
              onBlur={() => setDescTooltipVisible(false)}
              aria-label="Information"
            >
              ⓘ
            </button>
          )}
          {description && descTooltipVisible && (
            <div className={styles.descriptionTooltip}>{description}</div>
          )}
        </div>
      )}

      <div className={styles.sliderWrapper}>
        {showTooltip && tooltipVisible && (
          <div
            className={`${styles.tooltip} ${styles.tooltipVisible}`}
            style={{ left: `${percent}%` }}
          >
            {value}
            <div className={styles.tooltipArrow} />
          </div>
        )}

        <Slider.Root
          className={styles.sliderRoot}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          disabled={disabled}
          onPointerEnter={() => setTooltipVisible(true)}
          onPointerLeave={() => setTooltipVisible(false)}
          onFocus={() => setTooltipVisible(true)}
          onBlur={() => setTooltipVisible(false)}
        >
          <Slider.Track className={styles.sliderTrack}>
            <Slider.Range className={styles.sliderRange} />
          </Slider.Track>
          <Slider.Thumb className={styles.sliderThumb} />
        </Slider.Root>
      </div>
    </div>
  )
}
