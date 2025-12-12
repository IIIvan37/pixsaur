/**
 * RasterBasePalette: Displays the base palette used for raster optimization
 * This is a read-only view showing the global palette before raster changes
 */

import { useAtomValue } from 'jotai'
import { rasterBasePaletteAtom } from '@/app/store/raster/raster'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import styles from './color-palette.module.css'

function vectorToHex(vector: Vector): string {
  const [r, g, b] = vector
  return `#${r.toString(16).padStart(2, '0')}${g
    .toString(16)
    .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export const RasterBasePalette: React.FC = () => {
  const basePalette = useAtomValue(rasterBasePaletteAtom)

  if (!basePalette || basePalette.length === 0) {
    return null
  }

  return (
    <div className={styles.container}>
      <div className={styles.paletteGrid}>
        {basePalette.map((color, idx) => (
          <div
            key={`raster-ink-${idx}-${color[0]}-${color[1]}-${color[2]}`}
            className={styles.rasterSlot}
            style={{ backgroundColor: vectorToHex(color) }}
            title={`Ink ${idx}: RGB(${color[0]}, ${color[1]}, ${color[2]})`}
          />
        ))}
      </div>
    </div>
  )
}
