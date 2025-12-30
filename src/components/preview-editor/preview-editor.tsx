import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  applyEditModeAtom,
  cancelEditModeAtom,
  editorModeAtom,
  hasUnsavedChangesAtom,
  historyCountAtom
} from '@/app/store/editor'
import DraggableDialog from '@/components/ui/draggable-dialog'
import Icon from '@/components/ui/icon'
import { PreviewEditorView } from './preview-editor-view'

/**
 * Smart component for the preview editor.
 * Displays as a draggable modal dialog.
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

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel()
    }
  }

  return (
    <DraggableDialog
      open={isEditorMode}
      onOpenChange={handleOpenChange}
      title={
        <>
          <Icon name='Pencil2Icon' /> <Trans>Éditeur de Preview</Trans>
          {editCount > 0 && (
            <span
              style={{ opacity: 0.7, marginLeft: '8px', fontSize: '0.85em' }}
            >
              ({editCount})
            </span>
          )}
        </>
      }
      defaultPosition={{ x: 50, y: 50 }}
    >
      <PreviewEditorView
        hasChanges={hasChanges}
        editCount={editCount}
        onApply={handleApply}
        onCancel={handleCancel}
      />
    </DraggableDialog>
  )
}
