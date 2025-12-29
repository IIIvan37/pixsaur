/**
 * Mode R specific settings component
 */

import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import { useId } from 'react'
import {
  modeRAntiFlickerAtom,
  modeRMaxLuminanceDeltaAtom,
  modeRPreviewModeAtom
} from '@/app/store/config/config'
import { ToggleButtonGroup } from '@/components/ui/toggle-button-group'
import styles from '../../tabs/tab.module.css'

type ModeRPreviewMode = 'blended' | 'frameA' | 'frameB' | 'flicker'

export function ModeRSettings() {
  const [antiFlicker, setAntiFlicker] = useAtom(modeRAntiFlickerAtom)
  const [maxLuminanceDelta, setMaxLuminanceDelta] = useAtom(
    modeRMaxLuminanceDeltaAtom
  )
  const [previewMode, setPreviewMode] = useAtom(modeRPreviewModeAtom)

  const antiFlickerId = useId()
  const luminanceDeltaId = useId()
  const previewModeId = useId()

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

      <div className={styles.row}>
        <label className={styles.label} htmlFor={antiFlickerId}>
          <Trans>Anti-flicker</Trans>: {antiFlicker}%
        </label>
        <input
          id={antiFlickerId}
          type='range'
          min='0'
          max='100'
          value={antiFlicker}
          onChange={(e) => setAntiFlicker(Number(e.target.value))}
          className={styles.slider}
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor={luminanceDeltaId}>
          <Trans>Max luminance delta</Trans>: {maxLuminanceDelta}
        </label>
        <input
          id={luminanceDeltaId}
          type='range'
          min='0'
          max='255'
          value={maxLuminanceDelta}
          onChange={(e) => setMaxLuminanceDelta(Number(e.target.value))}
          className={styles.slider}
        />
      </div>

      <div className={styles.row}>
        <span className={styles.label} id={previewModeId}>
          <Trans>Preview mode</Trans>
        </span>
        <ToggleButtonGroup
          value={previewMode}
          onChange={setPreviewMode}
          options={previewModeOptions}
          aria-labelledby={previewModeId}
        />
      </div>
    </div>
  )
}
