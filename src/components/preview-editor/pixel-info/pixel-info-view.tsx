import { Trans } from '@lingui/react/macro'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import styles from './pixel-info.module.css'

export type PixelInfoViewProps = Readonly<{
  pixelInfo: {
    x: number
    y: number
    inkIndex: number
    color: Vector<'RGB'>
  } | null
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
 * Dumb component for displaying pixel information.
 */
export function PixelInfoView({ pixelInfo }: PixelInfoViewProps) {
  if (!pixelInfo) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <Trans>Survolez un pixel</Trans>
        </div>
      </div>
    )
  }

  const { x, y, inkIndex, color } = pixelInfo
  const hexColor = rgbToHex(color)

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <span className={styles.label}>
          <Trans>Position</Trans>
        </span>
        <span className={styles.value}>
          ({x}, {y})
        </span>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>
          <Trans>Encre</Trans>
        </span>
        <span className={styles.value}>{inkIndex}</span>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>
          <Trans>Couleur</Trans>
        </span>
        <span className={styles.value}>
          <span
            className={styles.colorPreview}
            style={{
              backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`
            }}
          />
          {hexColor}
        </span>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>RGB</span>
        <span className={styles.value}>
          ({color[0]}, {color[1]}, {color[2]})
        </span>
      </div>
    </div>
  )
}
