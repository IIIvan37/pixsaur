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
}

/**
 * 🎮 RGB Slider Component - DRY Implementation
 *
 * Composant réutilisable pour ajuster les valeurs RGB avec sliders.
 * Utilise le composant PixsaurSlider existant pour éviter la duplication.
 */
export function RgbSlider({
  value,
  onChange,
  disabled = false,
  label = 'RGB'
}: RgbSliderProps) {
  const [localValue, setLocalValue] = useState(value)

  const handleChange = useCallback(
    (component: 'r' | 'g' | 'b', newValue: number) => {
      let componentIndex: number
      if (component === 'r') {
        componentIndex = 0
      } else if (component === 'g') {
        componentIndex = 1
      } else {
        componentIndex = 2
      }

      const updated = [...localValue] as Vector
      updated[componentIndex] = newValue
      setLocalValue(updated)
      onChange(updated)
    },
    [localValue, onChange]
  )

  const [r, g, b] = localValue

  return (
    <div className={styles.container}>
      {label && <div className={styles.label}>{label}</div>}

      <Flex direction='column' gap='small'>
        <PixsaurSlider
          min={0}
          max={255}
          value={r}
          onChange={(val) => handleChange('r', val)}
          disabled={disabled}
          label='Rouge'
          hideLabel={false}
        />

        <PixsaurSlider
          min={0}
          max={255}
          value={g}
          onChange={(val) => handleChange('g', val)}
          disabled={disabled}
          label='Vert'
          hideLabel={false}
        />

        <PixsaurSlider
          min={0}
          max={255}
          value={b}
          onChange={(val) => handleChange('b', val)}
          disabled={disabled}
          label='Bleu'
          hideLabel={false}
        />

        <div
          className={styles.preview}
          style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
          title={`RGB(${r}, ${g}, ${b})`}
        />
      </Flex>
    </div>
  )
}
