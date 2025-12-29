/**
 * Mode R specific settings component
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import { Suspense, useId } from 'react'
import {
  modeRAntiFlickerAtom,
  modeRDualPaletteAtom,
  modeRMaxLuminanceDeltaAtom,
  modeRPreviewModeAtom
} from '@/app/store/config/config'
import { modeRPalettesAtom } from '@/app/store/preview/mode-r-preview'
import { TuningSlider } from '@/components/settings-panel/shared/tuning-slider'
import Checkbox from '@/components/ui/checkbox/checkbox'
import { ToggleButtonGroup } from '@/components/ui/toggle-button-group'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import styles from '../../tabs/tab.module.css'

type ModeRPreviewMode = 'blended' | 'frameA' | 'frameB' | 'flicker'

/**
 * Component to display a 16-color palette as a row of color swatches
 */
function PaletteDisplay({
  palette,
  label
}: Readonly<{
  palette: Array<Vector<'RGB'>>
  label: string
}>) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--gray-11)',
          marginRight: '8px'
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
        {palette.map((color, i) => (
          <div
            key={`${i}-${color[0]}-${color[1]}-${color[2]}`}
            title={`#${i}: RGB(${color[0]}, ${color[1]}, ${color[2]})`}
            style={{
              width: '16px',
              height: '16px',
              backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
              border: '1px solid var(--gray-6)',
              borderRadius: '2px'
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Component that loads and displays Mode R palettes
 */
function ModeRPalettesDisplay() {
  const palettes = useAtomValue(modeRPalettesAtom)

  if (!palettes) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--gray-9)' }}>
        <Trans>Chargez une image pour voir les palettes</Trans>
      </div>
    )
  }

  return (
    <div>
      <PaletteDisplay palette={palettes.paletteA} label='Frame A:' />
      <PaletteDisplay palette={palettes.paletteB} label='Frame B:' />
      <div
        style={{ fontSize: '10px', color: 'var(--gray-10)', marginTop: '4px' }}
      >
        <Trans>Paires uniques</Trans>: {palettes.uniquePairsUsed}
      </div>
    </div>
  )
}

export function ModeRSettings() {
  const dualPaletteId = useId()
  const { _ } = useLingui()
  const [antiFlicker, setAntiFlicker] = useAtom(modeRAntiFlickerAtom)
  const [maxLuminanceDelta, setMaxLuminanceDelta] = useAtom(
    modeRMaxLuminanceDeltaAtom
  )
  const [previewMode, setPreviewMode] = useAtom(modeRPreviewModeAtom)
  const [dualPalette, setDualPalette] = useAtom(modeRDualPaletteAtom)

  const previewModeOptions: Array<{ value: ModeRPreviewMode; label: string }> =
    [
      { value: 'blended', label: 'Blended' },
      { value: 'frameA', label: 'Frame A' },
      { value: 'frameB', label: 'Frame B' },
      { value: 'flicker', label: 'Flicker Map' }
    ]

  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>
        <Trans>Mode R Settings</Trans>
      </h4>

      <div className={styles.tuningRow}>
        <Checkbox
          id={dualPaletteId}
          checked={dualPalette}
          onChange={(e) => setDualPalette(e.target.checked)}
          label={_(msg`Double palette`)}
        />
        <span className={styles.description}>
          {_(
            msg`Utilise une palette différente pour chaque frame (plus de couleurs, plus de scintillement)`
          )}
        </span>
      </div>

      <TuningSlider
        label={_(msg`Anti-flicker`)}
        value={antiFlicker}
        onChange={setAntiFlicker}
        min={0}
        max={100}
        step={1}
        defaultValue={30}
        format={(v) => `${v}%`}
        description={_(
          msg`Réduit le scintillement en favorisant les couleurs similaires entre les frames`
        )}
        resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
      />

      <TuningSlider
        label={_(msg`Delta luminance max`)}
        value={maxLuminanceDelta}
        onChange={setMaxLuminanceDelta}
        min={0}
        max={255}
        step={1}
        defaultValue={50}
        format={(v) => v.toFixed(0)}
        description={_(
          msg`Différence de luminance maximale autorisée entre les couleurs alternées`
        )}
        resetTitle={_(msg`Réinitialiser à la valeur par défaut`)}
      />

      <div className={styles.tuningRow}>
        <div className={styles.tuningHeader}>
          <span className={styles.tuningLabel}>
            <Trans>Preview mode</Trans>
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
            <Trans>Palettes</Trans>
          </span>
        </div>
        <Suspense
          fallback={
            <div style={{ fontSize: '11px', color: 'var(--gray-9)' }}>
              <Trans>Chargement...</Trans>
            </div>
          }
        >
          <ModeRPalettesDisplay />
        </Suspense>
      </div>
    </div>
  )
}
