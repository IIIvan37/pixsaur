/**
 * Mode R specific settings component
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import { useId } from 'react'
import {
  modeRAntiFlickerAtom,
  modeRDualPaletteAtom,
  modeRMaxLuminanceDeltaAtom,
  modeRPreviewModeAtom
} from '@/app/store/config/config'
import { TuningSlider } from '@/components/settings-panel/shared/tuning-slider'
import Checkbox from '@/components/ui/checkbox/checkbox'
import { ToggleButtonGroup } from '@/components/ui/toggle-button-group'
import styles from '../../tabs/tab.module.css'

type ModeRPreviewMode = 'blended' | 'frameA' | 'frameB' | 'flicker'

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
    </div>
  )
}
