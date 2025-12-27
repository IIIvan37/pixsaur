import { useAtomValue, useSetAtom } from 'jotai'
import {
  applyEditModeAtom,
  cancelEditModeAtom,
  editorModeAtom,
  hasUnsavedChangesAtom,
  historyCountAtom
} from '@/app/store/editor'
import { PreviewEditorView } from './preview-editor-view'

/**
 * Smart component for the preview editor.
 * Main container that orchestrates all editor sub-components.
 */
export function PreviewEditor() {
  // State
  const isEditorMode = useAtomValue(editorModeAtom)
  const hasChanges = useAtomValue(hasUnsavedChangesAtom)
  const editCount = useAtomValue(historyCountAtom)

  // Actions
  const applyChanges = useSetAtom(applyEditModeAtom)
  const cancelEdit = useSetAtom(cancelEditModeAtom)

  const handleApply = () => {
    applyChanges()
  }

  const handleCancel = () => {
    // Future: Add confirmation dialog if hasChanges
    cancelEdit()
  }

  if (!isEditorMode) {
    return null
  }

  return (
    <PreviewEditorView
      hasChanges={hasChanges}
      editCount={editCount}
      onApply={handleApply}
      onCancel={handleCancel}
    />
  )
}
