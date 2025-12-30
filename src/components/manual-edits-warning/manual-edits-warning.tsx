import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import {
  clearManualEditsAtom,
  hasManualEditsAtom,
  manualEditsCountAtom,
  previewVersionAtom
} from '@/app/store/preview/preview'
import Icon from '@/components/ui/icon'
import styles from './manual-edits-warning.module.css'

/**
 * Warning banner that appears when there are manual pixel edits.
 * Warns the user that changing settings will affect their edits.
 * Automatically clears edits when the preview is regenerated.
 */
export function ManualEditsWarning() {
  const hasEdits = useAtomValue(hasManualEditsAtom)
  const editCount = useAtomValue(manualEditsCountAtom)
  const clearEdits = useSetAtom(clearManualEditsAtom)
  const previewVersion = useAtomValue(previewVersionAtom)
  const previousVersionRef = useRef<number | null>(null)

  // Clear edits when preview version changes (settings modified, new image, etc.)
  useEffect(() => {
    if (
      previousVersionRef.current !== null &&
      previewVersion !== previousVersionRef.current
    ) {
      // Preview has been regenerated, clear manual edits
      clearEdits()
    }
    previousVersionRef.current = previewVersion
  }, [previewVersion, clearEdits])

  if (!hasEdits) return null

  return (
    <div className={styles.warning}>
      <div className={styles.content}>
        <Icon name='ExclamationTriangleIcon' size={16} />
        <span className={styles.text}>
          <Trans>
            {editCount} pixel(s) modifié(s) manuellement. Modifier les
            paramètres peut affecter ces modifications.
          </Trans>
        </span>
      </div>
      <button
        type='button'
        className={styles.clearButton}
        onClick={() => clearEdits()}
        title='Effacer les modifications manuelles'
      >
        <Icon name='Cross2Icon' size={14} />
      </button>
    </div>
  )
}
