'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import styles from '../../styles/ui/slider.module.css'

interface SliderProps {
  min: number
  max: number
  value: number
  step?: number
  onChange: (value: number) => void
  label?: ReactNode
  valueLabel?: string
  showTooltip?: boolean
  hideLabel?: boolean
  compact?: boolean
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
}

export default function Slider({
  min,
  max,
  value,
  step,
  onChange,
  label,
  valueLabel = '%',
  showTooltip = true,
  hideLabel = false,
  compact = false,
  size = 'medium',
  disabled = false // ← valeur par défaut
}: SliderProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState(0)
  const sliderRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sliderRef.current) return
    const percent = ((value - min) / (max - min)) * 100
    setTooltipPosition(percent)
    thumbRef.current!.style.left = `${percent}%`
  }, [value, min, max])

  const labelString = typeof label === 'string' ? label : 'Slider'
  const sizeClass = styles[size] || ''

  return (
    <div
      className={[
        styles.container,
        compact && styles.compact,
        sizeClass,
        disabled && styles.disabled
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {!hideLabel && label && (
        <div className={styles.labelRow}>
          <div className={styles.label}>{label}</div>
        </div>
      )}

      <div
        ref={sliderRef}
        className={[styles.sliderWrapper].filter(Boolean).join(' ')}
      >
        {showTooltip && tooltipVisible && (
          <div
            className={`${styles.tooltip} ${styles.tooltipVisible}`}
            style={{ left: `${tooltipPosition}%` }}
          >
            {value}
            {valueLabel}
            <div className={styles.tooltipArrow} />
          </div>
        )}

        <div className={`${styles.sliderRoot} ${sizeClass}`}>
          <div className={styles.sliderTrack}>
            <div
              className={styles.sliderRange}
              style={{ width: `${tooltipPosition}%` }}
            />
          </div>

          <div
            ref={thumbRef}
            className={styles.sliderThumb}
            style={{ left: `${tooltipPosition}%` }}
          />

          <input
            type='range'
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled} // ← la prop est bien transmise
            onChange={(e) => onChange(Number(e.currentTarget.value))}
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
            onFocus={() => setTooltipVisible(true)}
            onBlur={() => setTooltipVisible(false)}
            className={styles.sliderInput}
            aria-label={`${labelString}: ${value}${valueLabel}`}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
          />
        </div>
      </div>
    </div>
  )
}
