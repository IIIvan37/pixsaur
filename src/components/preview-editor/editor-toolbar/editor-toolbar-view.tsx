import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import type { EditorTool, ZoomLevel } from '@/app/store/editor'
import Icon, { type IconName } from '@/components/ui/icon'
import styles from './editor-toolbar.module.css'

export type EditorToolbarViewProps = Readonly<{
  tool: EditorTool
  zoom: ZoomLevel
  gridVisible: boolean
  selectedInk: number
  canUndo: boolean
  canRedo: boolean
  onToolChange: (tool: EditorTool) => void
  onZoomChange: (zoom: ZoomLevel) => void
  onToggleGrid: () => void
  onUndo: () => void
  onRedo: () => void
}>

const ZOOM_LEVELS: ZoomLevel[] = [1, 2, 4, 8, 16]

const TOOLS: Array<{
  id: EditorTool
  icon: IconName
  labelKey: string
  shortcut: string
}> = [
  { id: 'pencil', icon: 'BlendingModeIcon', labelKey: 'Crayon', shortcut: 'P' },
  {
    id: 'eyedropper',
    icon: 'ComponentInstanceIcon',
    labelKey: 'Pipette',
    shortcut: 'I'
  },
  { id: 'fill', icon: 'ImageIcon', labelKey: 'Remplir', shortcut: 'G' },
  {
    id: 'select',
    icon: 'AspectRatioIcon',
    labelKey: 'Sélection',
    shortcut: 'S'
  }
]

/**
 * Dumb component for the editor toolbar.
 * Renders tools, zoom controls, and action buttons.
 */
export function EditorToolbarView({
  tool,
  zoom,
  gridVisible,
  canUndo,
  canRedo,
  onToolChange,
  onZoomChange,
  onToggleGrid,
  onUndo,
  onRedo
}: EditorToolbarViewProps) {
  const { _ } = useLingui()

  return (
    <div className={styles.toolbar}>
      {/* Tools */}
      <div className={styles.toolGroup}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type='button'
            className={`${styles.toolButton} ${tool === t.id ? styles.active : ''}`}
            onClick={() => onToolChange(t.id)}
            title={`${_(msg`${t.labelKey}`)} (${t.shortcut})`}
            aria-pressed={tool === t.id}
          >
            <Icon name={t.icon} size={18} />
          </button>
        ))}
      </div>

      <div className={styles.separator} />

      {/* Undo/Redo */}
      <div className={styles.toolGroup}>
        <button
          type='button'
          className={styles.toolButton}
          onClick={onUndo}
          disabled={!canUndo}
          title={_(msg`Annuler (Ctrl+Z)`)}
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
    </div>
  )
}
