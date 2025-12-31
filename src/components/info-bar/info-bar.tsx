import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom,
  egxEnabledAtom,
  egxTypeAtom
} from '@/app/store/config/config'
import { exportPaletteWithSlotsAtom } from '@/app/store/preview/preview'
import { rasterChangesAtom, rasterEnabledAtom } from '@/app/store/raster/raster'
import styles from './info-bar.module.css'

/**
 * Information bar displaying current image configuration
 * Shows: hardware, mode, dimensions, raster status, and unique colors count
 */
export function InfoBar() {
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const rasterChanges = useAtomValue(rasterChangesAtom)
  const palette = useAtomValue(exportPaletteWithSlotsAtom)
  const egxEnabled = useAtomValue(egxEnabledAtom)
  const egxType = useAtomValue(egxTypeAtom)

  const hasRasters = rasterEnabled && rasterChanges.length > 0

  // Count unique colors: palette colors + raster colors (when rasters are active)
  const uniqueColorsCount = useMemo(() => {
    if (!hasRasters) return null

    const colorSet = new Set<string>()
    // Add palette colors (filter out ignored slots [-1,-1,-1])
    for (const color of palette) {
      if (color[0] !== -1 || color[1] !== -1 || color[2] !== -1) {
        colorSet.add(`${color[0]},${color[1]},${color[2]}`)
      }
    }
    // Add raster change colors
    for (const change of rasterChanges) {
      colorSet.add(change.color.join(','))
    }
    return colorSet.size
  }, [hasRasters, palette, rasterChanges])

  const dimensionsText = modeConfig.overscan
    ? `${modeConfig.width}×${modeConfig.height} (overscan)`
    : `${modeConfig.width}×${modeConfig.height}`

  const hardwareLabel = cpcHardware === 'plus' ? 'CPC Plus' : 'CPC Classic'

  return (
    <div className={styles.infoBar}>
      <span className={styles.item}>
        <span className={styles.value}>{hardwareLabel}</span>
      </span>

      <span className={styles.separator}>|</span>

      <span className={styles.item}>
        <span className={styles.label}>
          <Trans>Mode</Trans>
        </span>
        <span className={styles.value}>{modeConfig.mode}</span>
      </span>

      {egxEnabled && (
        <>
          <span className={styles.separator}>|</span>
          <span className={styles.item}>
            <span className={styles.valueActive}>
              {egxType === 'egx1' ? 'EGX1' : 'EGX2'}
            </span>
          </span>
        </>
      )}

      <span className={styles.separator}>|</span>

      <span className={styles.item}>
        <span className={styles.label}>
          <Trans>Dimensions</Trans>
        </span>
        <span className={styles.value}>{dimensionsText}</span>
      </span>

      <span className={styles.separator}>|</span>

      <span className={styles.item}>
        <span className={styles.label}>
          <Trans>Rasters</Trans>
        </span>
        <span className={hasRasters ? styles.valueActive : styles.value}>
          {hasRasters ? (
            <Trans>Oui ({rasterChanges.length})</Trans>
          ) : (
            <Trans>Non</Trans>
          )}
        </span>
      </span>

      {uniqueColorsCount !== null && (
        <>
          <span className={styles.separator}>|</span>
          <span className={styles.item}>
            <span className={styles.label}>
              <Trans>Couleurs</Trans>
            </span>
            <span className={styles.valueHighlight}>{uniqueColorsCount}</span>
          </span>
        </>
      )}
    </div>
  )
}
