import * as Slider from '@radix-ui/react-slider'
import clsx from 'clsx'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import styles from './slider.module.css'

type PixsaurSliderProps = {
  readonly min: number
  readonly max: number
  readonly value: number
  readonly step?: number
  readonly onChange: (val: number) => void
  readonly label?: ReactNode
  readonly description?: ReactNode
  readonly hideLabel?: boolean
  readonly disabled?: boolean
  readonly showTooltip?: boolean
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
  const tooltipRef = useRef<HTMLDivElement>(null)
  const infoIconRef = useRef<HTMLButtonElement>(null)
  const [tooltipAlignment, setTooltipAlignment] = useState<
    'center' | 'left' | 'right'
  >('center')
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const p = ((value - min) / (max - min)) * 100
    setPercent(p)
  }, [value, min, max])

  // Détecter le débordement du tooltip de description et calculer sa position
  useEffect(() => {
    if (descTooltipVisible && tooltipRef.current && infoIconRef.current) {
      const iconRect = infoIconRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth

      // Position de base : centrée sous l'icône
      let left = iconRect.left + iconRect.width / 2
      const top = iconRect.bottom + 8

      let alignment: 'center' | 'left' | 'right' = 'center'

      // Vérifier le débordement avec la largeur du tooltip
      const tooltipWidth = tooltipRect.width || 200 // fallback

      // Déborde à gauche
      if (left - tooltipWidth / 2 < 10) {
        alignment = 'left'
        left = Math.max(10, iconRect.left)
      }
      // Déborde à droite
      else if (left + tooltipWidth / 2 > viewportWidth - 10) {
        alignment = 'right'
        left = Math.min(viewportWidth - 10, iconRect.right)
      }

      setTooltipAlignment(alignment)
      setTooltipPosition({ top, left })
    }
  }, [descTooltipVisible])

  return (
    <div className={clsx(styles.container, disabled && styles.disabled)}>
      {!hideLabel && label && (
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          {description && (
            <button
              ref={infoIconRef}
              type='button'
              className={styles.infoIcon}
              onMouseEnter={() => setDescTooltipVisible(true)}
              onMouseLeave={() => setDescTooltipVisible(false)}
              onFocus={() => setDescTooltipVisible(true)}
              onBlur={() => setDescTooltipVisible(false)}
              aria-label='Information'
            >
              ⓘ
            </button>
          )}
          {description && descTooltipVisible && (
            <div
              ref={tooltipRef}
              className={clsx(
                styles.descriptionTooltip,
                tooltipAlignment === 'left' && styles.tooltipAlignLeft,
                tooltipAlignment === 'center' && styles.tooltipAlignCenter,
                tooltipAlignment === 'right' && styles.tooltipAlignRight
              )}
              style={{
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`
              }}
            >
              {description}
            </div>
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
