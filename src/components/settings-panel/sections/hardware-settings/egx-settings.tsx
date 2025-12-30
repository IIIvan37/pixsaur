/**
 * EGX mode specific settings component
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import { Suspense } from 'react'
import {
  egxFirstLineModeAtom,
  egxPreviewModeAtom,
  egxTypeAtom
} from '@/app/store/config/config'
import { egxPaletteAtom } from '@/app/store/preview/egx-preview'
import { ToggleButtonGroup } from '@/components/ui/toggle-button-group'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type {
  EGXFirstLineMode,
  EGXPreviewMode,
  EGXType
} from '@/libs/pixsaur-egx'
import styles from '../../tabs/tab.module.css'

/**
 * Component to display the EGX palette with shared colors highlighted
 */
function PaletteDisplay({
  colors,
  sharedColorCount
}: Readonly<{
  colors: Array<Vector<'RGB'>>
  sharedColorCount: number
}>) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
        {colors.map((color, i) => {
          const isShared = i < sharedColorCount
          return (
            <div
              key={`${i}-${color[0]}-${color[1]}-${color[2]}`}
              title={`#${i}: RGB(${color[0]}, ${color[1]}, ${color[2]})${isShared ? ' (shared)' : ''}`}
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
                border: isShared
                  ? '2px solid var(--accent-9)'
                  : '1px solid var(--gray-6)',
                borderRadius: '2px'
              }}
            />
          )
        })}
      </div>
      <div
        style={{ fontSize: '10px', color: 'var(--gray-10)', marginTop: '4px' }}
      >
        <Trans>Couleurs partagées</Trans>: {sharedColorCount}
        {' | '}
        <Trans>Total</Trans>: {colors.length}
      </div>
    </div>
  )
}

/**
 * Component that loads and displays EGX palette
 */
function EGXPaletteDisplay() {
  const paletteInfo = useAtomValue(egxPaletteAtom)

  if (!paletteInfo) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--gray-9)' }}>
        <Trans>Chargez une image pour voir la palette</Trans>
      </div>
    )
  }

  return (
    <PaletteDisplay
      colors={paletteInfo.colors}
      sharedColorCount={paletteInfo.sharedColorCount}
    />
  )
}

export function EGXSettings() {
  const { _ } = useLingui()
  const [egxType, setEgxType] = useAtom(egxTypeAtom)
  const [firstLineMode, setFirstLineMode] = useAtom(egxFirstLineModeAtom)
  const [previewMode, setPreviewMode] = useAtom(egxPreviewModeAtom)

  const egxTypeOptions: Array<{ value: EGXType; label: string }> = [
    { value: 'egx1', label: 'EGX1 (Mode 0/1)' },
    { value: 'egx2', label: 'EGX2 (Mode 1/2)' }
  ]

  const firstLineModeOptions: Array<{
    value: EGXFirstLineMode
    label: string
  }> = [
    { value: 'low', label: _(msg`Low Res first`) },
    { value: 'high', label: _(msg`High Res first`) }
  ]

  const previewModeOptions: Array<{ value: EGXPreviewMode; label: string }> = [
    { value: 'combined', label: _(msg`Combined`) },
    { value: 'lowLines', label: _(msg`Low Res Lines`) },
    { value: 'highLines', label: _(msg`High Res Lines`) }
  ]

  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>
        <Trans>EGX Settings</Trans>
      </h4>

      <div className={styles.tuningRow}>
        <div className={styles.tuningHeader}>
          <span className={styles.tuningLabel}>
            <Trans>EGX Type</Trans>
          </span>
        </div>
        <ToggleButtonGroup
          value={egxType}
          onChange={setEgxType}
          options={egxTypeOptions}
          ariaLabelPrefix='EGX Type'
        />
        <span className={styles.description}>
          {egxType === 'egx1'
            ? _(
                msg`320×200, jusqu'à 16 couleurs (INK 0-3 partagés entre modes)`
              )
            : _(
                msg`640×200, jusqu'à 4 couleurs (INK 0-1 partagés entre modes)`
              )}
        </span>
      </div>

      <div className={styles.tuningRow}>
        <div className={styles.tuningHeader}>
          <span className={styles.tuningLabel}>
            <Trans>First Line Mode</Trans>
          </span>
        </div>
        <ToggleButtonGroup
          value={firstLineMode}
          onChange={setFirstLineMode}
          options={firstLineModeOptions}
          ariaLabelPrefix='First Line Mode'
        />
        <span className={styles.description}>
          {firstLineMode === 'low'
            ? _(msg`Ligne 0 en mode basse résolution (plus de couleurs)`)
            : _(msg`Ligne 0 en mode haute résolution (plus de détails)`)}
        </span>
      </div>

      <div className={styles.tuningRow}>
        <div className={styles.tuningHeader}>
          <span className={styles.tuningLabel}>
            <Trans>Preview Mode</Trans>
          </span>
        </div>
        <ToggleButtonGroup
          value={previewMode}
          onChange={setPreviewMode}
          options={previewModeOptions}
          ariaLabelPrefix='Preview'
        />
      </div>

      <div className={styles.tuningRow}>
        <div className={styles.tuningHeader}>
          <span className={styles.tuningLabel}>
            <Trans>Palette</Trans>
          </span>
        </div>
        <Suspense
          fallback={
            <div style={{ fontSize: '11px', color: 'var(--gray-9)' }}>
              <Trans>Chargement...</Trans>
            </div>
          }
        >
          <EGXPaletteDisplay />
        </Suspense>
      </div>
    </div>
  )
}
