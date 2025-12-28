import { Trans } from '@lingui/react/macro'
import { useRef } from 'react'
import Icon from '@/components/ui/icon'
import { EditorCanvas } from './editor-canvas'
import { EditorMinimap } from './editor-minimap'
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
 * Dumb component for the preview editor content.
 * Arranges toolbar, canvas, palette, and info panels inside the dialog.
 */
export function PreviewEditorView({
  hasChanges,
  onApply,
  onCancel
}: PreviewEditorViewProps) {
  // Shared ref for canvas container - used by both EditorCanvas and EditorMinimap
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <EditorToolbar />

      {/* Main content area */}
      <div className={styles.content}>
        {/* Canvas area */}
        <div className={styles.canvasArea}>
          <EditorCanvas
            containerRef={canvasContainerRef}
            onEscape={onCancel}
            onSave={hasChanges ? onApply : undefined}
          />
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <EditorMinimap containerRef={canvasContainerRef} />
          <LinePalette />
          <PixelInfo />
        </div>
      </div>

      {/* Footer with actions */}
      <div className={styles.footer}>
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
  )
}
