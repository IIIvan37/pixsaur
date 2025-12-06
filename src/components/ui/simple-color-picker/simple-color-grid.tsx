import { ColorButton } from '@/components/color-palette/color-slot/color-button'
import type { CPCColor } from '@/libs/types'
import styles from './simple-color-picker.module.css'

export interface SimpleColorGridProps {
  /** Full CPC palette (27 colors for Classic) */
  readonly palette: CPCColor[]
  /** Callback when a color is selected */
  readonly onColorSelect: (color: CPCColor) => void
}

/**
 * Simple color grid for CPC Classic mode (27 colors)
 * No lock/clear buttons - just color selection
 */
export function SimpleColorGrid({
  palette,
  onColorSelect
}: SimpleColorGridProps) {
  return (
    <div className={styles.colorGrid}>
      {palette.map((color) => (
        <ColorButton
          key={color.hex}
          colorHex={`#${color.hex}`}
          className={styles.colorOption}
          title={color.name}
          onClick={() => onColorSelect(color)}
        />
      ))}
    </div>
  )
}
