import { Trans } from '@lingui/react/macro'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import styles from './line-palette.module.css'

export type LinePaletteViewProps = Readonly<{
  palette: Vector<'RGB'>[]
  selectedInk: number
  currentLine: number
  onSelectInk: (index: number) => void
}>

/**
 * Convert RGB color to hex string
 */
function rgbToHex(color: Vector<'RGB'>): string {
  return `#${Array.from(color)
    .map((c) => Math.round(c).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

/**
 * Dumb component for displaying the line palette.
 * Shows all colors available for the current line.
 */
export function LinePaletteView({
  palette,
  selectedInk,
  currentLine,
  onSelectInk
}: LinePaletteViewProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Trans>Palette</Trans>
        </span>
        <span className={styles.lineInfo}>
          <Trans>Ligne {currentLine}</Trans>
        </span>
      </div>

      <div className={styles.paletteGrid}>
        {palette.map((color, inkId) => {
          const isSelected = inkId === selectedInk
          const rgbString = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
          const hexString = rgbToHex(color)

          // Use ink position + color values for stable unique key
          return (
            <button
              key={`ink-${inkId}-${color[0]}-${color[1]}-${color[2]}`}
              type='button'
              className={`${styles.colorSwatch} ${isSelected ? styles.selected : ''}`}
              style={{ backgroundColor: rgbString }}
              onClick={() => onSelectInk(inkId)}
              title={`Encre ${inkId}: ${hexString}`}
              aria-pressed={isSelected}
            >
              <span className={styles.inkIndex}>{inkId}</span>
            </button>
          )
        })}
      </div>

      {/* Selected color info */}
      <div className={styles.selectedInfo}>
        <div
          className={styles.selectedPreview}
          style={{
            backgroundColor: `rgb(${palette[selectedInk]?.[0] ?? 0}, ${palette[selectedInk]?.[1] ?? 0}, ${palette[selectedInk]?.[2] ?? 0})`
          }}
        />
        <div className={styles.selectedDetails}>
          <span className={styles.inkLabel}>
            <Trans>Encre</Trans> {selectedInk}
          </span>
          <span className={styles.colorValue}>
            {palette[selectedInk] ? rgbToHex(palette[selectedInk]) : '#000000'}
          </span>
        </div>
      </div>
    </div>
  )
}
