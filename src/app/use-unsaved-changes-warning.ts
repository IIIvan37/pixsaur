import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { hasManualEditsAtom } from '@/app/store/preview/preview'

/**
 * Prompts the user with the browser's native confirmation dialog when they try
 * to leave (reload/close the tab) while unsaved manual pixel edits exist.
 *
 * Manual edits are not persisted, so navigating away loses them silently
 * otherwise. The listener is only attached while edits are present.
 */
export function useUnsavedChangesWarning() {
  const hasManualEdits = useAtomValue(hasManualEditsAtom)

  useEffect(() => {
    if (!hasManualEdits) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Per the current spec, calling preventDefault() is enough to trigger the
      // browser's native "leave site?" confirmation (the legacy returnValue
      // assignment is deprecated).
      event.preventDefault()
    }

    globalThis.addEventListener('beforeunload', handleBeforeUnload)
    return () =>
      globalThis.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasManualEdits])
}
