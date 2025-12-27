import { Trans } from '@lingui/react/macro'
import Icon from '@/components/ui/icon'
import { EditorCanvas } from './editor-canvas'
import { EditorToolbar } from './editor-toolbar'
import { LinePalette } from './line-palette'
import { PixelInfo } from './pixel-info'
import styles from './preview-editor.module.css'

export type PreviewEditorViewProps = Readonly<{
  hasChanges: boolean
  editCount: number
  onApply: () => void
  onCancel: () => void
}>

/**
 * Dumb component for the preview editor layout.
 * Arranges toolbar, canvas, palette, and info panels.
 */
export function PreviewEditorView({
  hasChanges,
  editCount,
  onApply,
  onCancel
}: PreviewEditorViewProps) {
  return (
    <div className={styles.container}>
      {/* Header with close button */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Icon name='BlendingModeIcon' size={18} />
          <span>
            <Trans>Mode Édition</Trans>
          </span>
          {editCount > 0 && (
            <span className={styles.editCount}>
              ({editCount} <Trans>modification(s)</Trans>)
            </span>
          )}
        </div>

        <div className={styles.headerActions}>
          <button
            type='button'
            className={styles.cancelButton}
            onClick={onCancel}
          >
            <Trans>Annuler</Trans>
          </button>
          <button
            type='button'
            className={styles.applyButton}
            onClick={onApply}
            disabled={!hasChanges}
          >
            <Icon name='CheckIcon' size={16} />
            <Trans>Appliquer</Trans>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <EditorToolbar />

      {/* Main content area */}
      <div className={styles.content}>
        {/* Canvas area */}
        <div className={styles.canvasArea}>
          <EditorCanvas />
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <LinePalette />
          <PixelInfo />
        </div>
      </div>
    </div>
  )
}
