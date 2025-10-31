import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useCallback, useState } from 'react'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import Flex from '../flex'
import PixsaurSlider from '../slider'
import styles from './rgb-slider.module.css'

export interface RgbSliderProps {
  readonly value: Vector
  readonly onChange: (value: Vector) => void
  readonly disabled?: boolean
  readonly label?: string
  readonly showPreview?: boolean
}

/**
 * RGB Slider Component - CPC Plus Implementation
 *
 * Composant réutilisable pour ajuster les valeurs RGB avec sliders.
 * Utilise 16 niveaux 4-bit (0-15) convertis automatiquement vers RGB 0-255.
 */
export function RgbSlider({
  value,
  onChange,
  disabled = false,
  label = 'RGB',
  showPreview = true
}: RgbSliderProps) {
  const { _ } = useLingui()
  const [localValue, setLocalValue] = useState(value)

  // Convertit RGB (0-255) vers valeur normalisée du slider (0-15)
  const toSliderValue = useCallback((rgbValue: number): number => {
    return Math.round((rgbValue / 255) * 15)
  }, [])

  // Convertit valeur normalisée du slider (0-15) vers RGB (0-255)
  const toRgbValue = useCallback((sliderValue: number): number => {
    return Math.round((sliderValue / 15) * 255)
  }, [])

  const handleChange = useCallback(
    (componentIndex: number, sliderValue: number) => {
      const rgbValue = toRgbValue(sliderValue)
      const updated = [...localValue] as Vector
      updated[componentIndex] = rgbValue
      setLocalValue(updated)
      onChange(updated)
    },
    [localValue, onChange, toRgbValue]
  )

  const [r, g, b] = localValue
  const maxSliderValue = 15

  const rgbChannels = [
    { index: 0, value: r, label: _(msg`Rouge`) },
    { index: 1, value: g, label: _(msg`Vert`) },
    { index: 2, value: b, label: _(msg`Bleu`) }
  ]

  return (
    <div className={styles.container}>
      {label && <div className={styles.label}>{label}</div>}

      <Flex direction='column' gap='small'>
        {rgbChannels.map(({ index, value, label }) => (
          <PixsaurSlider
            key={index}
            min={0}
            max={maxSliderValue}
            value={toSliderValue(value)}
            onChange={(val) => handleChange(index, val)}
            disabled={disabled}
            label={`${label} (${value})`}
            hideLabel={false}
          />
        ))}

        {showPreview && (
          <div
            className={styles.preview}
            style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
            title={`RGB(${r}, ${g}, ${b})`}
          />
        )}
      </Flex>
    </div>
  )
}
