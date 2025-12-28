import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import type { ZoomLevel } from '@/app/store/editor'
import Icon from '@/components/ui/icon'
import { HelpButton } from '../help-button'
import styles from './editor-toolbar.module.css'

export type EditorToolbarViewProps = Readonly<{
  zoom: ZoomLevel
  gridVisible: boolean
  selectedInk: number
  canUndo: boolean
  canRedo: boolean
  onZoomChange: (zoom: ZoomLevel) => void
  onToggleGrid: () => void
  onUndo: () => void
  onRedo: () => void
}>

const ZOOM_LEVELS: ZoomLevel[] = [1, 2, 4, 8, 16]

/**
 * Dumb component for the editor toolbar.
 * Renders zoom controls and action buttons.
 */
export function EditorToolbarView({
  zoom,
  gridVisible,
  canUndo,
  canRedo,
  onZoomChange,
  onToggleGrid,
  onUndo,
  onRedo
}: EditorToolbarViewProps) {
  const { _ } = useLingui()

  return (
    <div className={styles.toolbar}>
      {/* Undo/Redo */}
      <div className={styles.toolGroup}>
        <button
          type='button'
          className={styles.toolButton}
          onClick={onUndo}
          disabled={!canUndo}
          title={_(msg`Annuler (Ctrl+Z)`)}
          style={{ transform: 'scaleX(-1)' }}
        >
          <Icon name='ReloadIcon' size={18} />
        </button>
        <button
          type='button'
          className={styles.toolButton}
          onClick={onRedo}
          disabled={!canRedo}
          title={_(msg`Refaire (Ctrl+Y)`)}
        >
          <Icon name='ReloadIcon' size={18} />
        </button>
      </div>

      <div className={styles.separator} />

      {/* Zoom */}
      <div className={styles.toolGroup}>
        <span className={styles.label}>{_(msg`Zoom`)}</span>
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z}
            type='button'
            className={`${styles.zoomButton} ${zoom === z ? styles.active : ''}`}
            onClick={() => onZoomChange(z)}
            aria-pressed={zoom === z}
          >
            {z}x
          </button>
        ))}
      </div>

      <div className={styles.separator} />

      {/* Grid toggle */}
      <div className={styles.toolGroup}>
        <button
          type='button'
          className={`${styles.toolButton} ${gridVisible ? styles.active : ''}`}
          onClick={onToggleGrid}
          title={_(msg`Grille (H)`)}
          aria-pressed={gridVisible}
        >
          <Icon name='AspectRatioIcon' size={18} />
        </button>
      </div>

      <div className={styles.spacer} />

      {/* Help */}
      <HelpButton />
    </div>
  )
}
