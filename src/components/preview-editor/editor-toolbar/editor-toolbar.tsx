import { useAtomValue, useSetAtom } from 'jotai'
import {
  canRedoAtom,
  canUndoAtom,
  type EditorTool,
  editorGridVisibleAtom,
  editorSelectedInkAtom,
  editorToolAtom,
  editorZoomAtom,
  redoEditAtom,
  setZoomAtom,
  toggleGridAtom,
  undoEditAtom,
  type ZoomLevel
} from '@/app/store/editor'
import { EditorToolbarView } from './editor-toolbar-view'

/**
 * Smart component for the editor toolbar.
 * Connects to store and handles tool/zoom selection.
 */
export function EditorToolbar() {
  // State
  const tool = useAtomValue(editorToolAtom)
  const zoom = useAtomValue(editorZoomAtom)
  const gridVisible = useAtomValue(editorGridVisibleAtom)
  const selectedInk = useAtomValue(editorSelectedInkAtom)
  const canUndo = useAtomValue(canUndoAtom)
  const canRedo = useAtomValue(canRedoAtom)

  // Actions
  const setTool = useSetAtom(editorToolAtom)
  const setZoom = useSetAtom(setZoomAtom)
  const toggleGrid = useSetAtom(toggleGridAtom)
  const undo = useSetAtom(undoEditAtom)
  const redo = useSetAtom(redoEditAtom)

  const handleToolChange = (newTool: EditorTool) => {
    setTool(newTool)
  }

  const handleZoomChange = (newZoom: ZoomLevel) => {
    setZoom(newZoom)
  }

  return (
    <EditorToolbarView
      tool={tool}
      zoom={zoom}
      gridVisible={gridVisible}
      selectedInk={selectedInk}
      canUndo={canUndo}
      canRedo={canRedo}
      onToolChange={handleToolChange}
      onZoomChange={handleZoomChange}
      onToggleGrid={toggleGrid}
      onUndo={undo}
      onRedo={redo}
    />
  )
}
