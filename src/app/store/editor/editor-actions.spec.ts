import { createStore } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  cancelEditModeAtom,
  inkCountAtom,
  moveCursorAtom,
  nextInkAtom,
  paintAtCursorAtom,
  paintPixelAtom,
  paintPixelsAtom,
  prevInkAtom,
  redoEditAtom,
  selectInkAtom,
  setZoomAtom,
  toggleGridAtom,
  undoEditAtom,
  zoomInAtom,
  zoomOutAtom
} from './editor-actions'
import {
  editorCursorAtom,
  editorGridVisibleAtom,
  editorModeAtom,
  editorSelectedInkAtom,
  editorZoomAtom
} from './editor-config'
import {
  editorBasePaletteAtom,
  editorDimensionsAtom,
  editorHistoryAtom,
  editorHistoryIndexAtom,
  editorIndexBufferAtom,
  editorOriginalBufferAtom,
  MAX_HISTORY_SIZE
} from './editor-state'

describe('editor-actions', () => {
  describe('paintPixelAtom', () => {
    it('should paint a pixel and create history entry', () => {
      const store = createStore()
      const buffer = new Uint8Array([0, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorSelectedInkAtom, 5)

      store.set(paintPixelAtom, { x: 1, y: 0 })

      const newBuffer = store.get(editorIndexBufferAtom)!
      expect(newBuffer[1]).toBe(5)

      const history = store.get(editorHistoryAtom)
      expect(history).toHaveLength(1)
      expect(history[0].type).toBe('pixel')
      expect(history[0].edits[0]).toEqual({
        x: 1,
        y: 0,
        previousInkIndex: 0,
        newInkIndex: 5
      })
    })

    it('should not paint if same color', () => {
      const store = createStore()
      const buffer = new Uint8Array([5, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorSelectedInkAtom, 5)

      store.set(paintPixelAtom, { x: 0, y: 0 })

      const history = store.get(editorHistoryAtom)
      expect(history).toHaveLength(0)
    })

    it('should ignore out-of-bounds coordinates', () => {
      const store = createStore()
      const buffer = new Uint8Array([0, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorSelectedInkAtom, 5)

      store.set(paintPixelAtom, { x: -1, y: 0 })
      store.set(paintPixelAtom, { x: 0, y: 10 })

      expect(store.get(editorHistoryAtom)).toHaveLength(0)
    })

    it('should limit history size', () => {
      const store = createStore()
      const buffer = new Uint8Array(200)
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 200, height: 1 })
      store.set(editorSelectedInkAtom, 1)

      // Paint more than MAX_HISTORY_SIZE times
      for (let i = 0; i < MAX_HISTORY_SIZE + 10; i++) {
        store.set(editorSelectedInkAtom, (i % 15) + 1)
        store.set(paintPixelAtom, { x: i, y: 0 })
      }

      const history = store.get(editorHistoryAtom)
      expect(history).toHaveLength(MAX_HISTORY_SIZE)
    })
  })

  describe('paintPixelsAtom', () => {
    it('should paint multiple pixels', () => {
      const store = createStore()
      const buffer = new Uint8Array([0, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorSelectedInkAtom, 3)

      store.set(paintPixelsAtom, [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ])

      const newBuffer = store.get(editorIndexBufferAtom)!
      expect(newBuffer[0]).toBe(3)
      expect(newBuffer[3]).toBe(3)

      const history = store.get(editorHistoryAtom)
      expect(history).toHaveLength(1)
      expect(history[0].type).toBe('region')
      expect(history[0].edits).toHaveLength(2)
    })

    it('should skip duplicates and same-color pixels', () => {
      const store = createStore()
      const buffer = new Uint8Array([3, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorSelectedInkAtom, 3)

      store.set(paintPixelsAtom, [
        { x: 0, y: 0 }, // Same color
        { x: 1, y: 0 }
      ])

      const history = store.get(editorHistoryAtom)
      expect(history[0].edits).toHaveLength(1)
    })

    it('should not create history entry if no changes', () => {
      const store = createStore()
      const buffer = new Uint8Array([3, 3, 3, 3])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorSelectedInkAtom, 3)

      store.set(paintPixelsAtom, [{ x: 0, y: 0 }])

      expect(store.get(editorHistoryAtom)).toHaveLength(0)
    })
  })

  describe('undoEditAtom', () => {
    it('should undo a paint operation', () => {
      const store = createStore()
      const buffer = new Uint8Array([0, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorSelectedInkAtom, 5)

      store.set(paintPixelAtom, { x: 0, y: 0 })
      expect(store.get(editorIndexBufferAtom)![0]).toBe(5)

      store.set(undoEditAtom)
      expect(store.get(editorIndexBufferAtom)![0]).toBe(0)
      expect(store.get(editorHistoryIndexAtom)).toBe(-1)
    })

    it('should do nothing if no history', () => {
      const store = createStore()
      const buffer = new Uint8Array([0, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorHistoryIndexAtom, -1)

      store.set(undoEditAtom)
      expect(store.get(editorHistoryIndexAtom)).toBe(-1)
    })
  })

  describe('redoEditAtom', () => {
    it('should redo an undone operation', () => {
      const store = createStore()
      const buffer = new Uint8Array([0, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorSelectedInkAtom, 5)

      store.set(paintPixelAtom, { x: 0, y: 0 })
      store.set(undoEditAtom)
      expect(store.get(editorIndexBufferAtom)![0]).toBe(0)

      store.set(redoEditAtom)
      expect(store.get(editorIndexBufferAtom)![0]).toBe(5)
      expect(store.get(editorHistoryIndexAtom)).toBe(0)
    })

    it('should do nothing if at end of history', () => {
      const store = createStore()
      const buffer = new Uint8Array([0, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorSelectedInkAtom, 5)
      store.set(paintPixelAtom, { x: 0, y: 0 })

      const indexBefore = store.get(editorHistoryIndexAtom)
      store.set(redoEditAtom)
      expect(store.get(editorHistoryIndexAtom)).toBe(indexBefore)
    })
  })

  describe('moveCursorAtom', () => {
    it('should move cursor in all directions', () => {
      const store = createStore()
      store.set(editorDimensionsAtom, { width: 100, height: 100 })
      store.set(editorCursorAtom, { x: 50, y: 50 })

      store.set(moveCursorAtom, 'up')
      expect(store.get(editorCursorAtom)).toEqual({ x: 50, y: 49 })

      store.set(moveCursorAtom, 'down')
      expect(store.get(editorCursorAtom)).toEqual({ x: 50, y: 50 })

      store.set(moveCursorAtom, 'left')
      expect(store.get(editorCursorAtom)).toEqual({ x: 49, y: 50 })

      store.set(moveCursorAtom, 'right')
      expect(store.get(editorCursorAtom)).toEqual({ x: 50, y: 50 })
    })

    it('should use large step with shift key', () => {
      const store = createStore()
      store.set(editorDimensionsAtom, { width: 100, height: 100 })
      store.set(editorCursorAtom, { x: 50, y: 50 })

      store.set(moveCursorAtom, 'right', true)
      expect(store.get(editorCursorAtom)).toEqual({ x: 58, y: 50 })
    })

    it('should clamp to boundaries', () => {
      const store = createStore()
      store.set(editorDimensionsAtom, { width: 10, height: 10 })
      store.set(editorCursorAtom, { x: 0, y: 0 })

      store.set(moveCursorAtom, 'left')
      expect(store.get(editorCursorAtom)!.x).toBe(0)

      store.set(moveCursorAtom, 'up')
      expect(store.get(editorCursorAtom)!.y).toBe(0)

      store.set(editorCursorAtom, { x: 9, y: 9 })
      store.set(moveCursorAtom, 'right')
      expect(store.get(editorCursorAtom)!.x).toBe(9)

      store.set(moveCursorAtom, 'down')
      expect(store.get(editorCursorAtom)!.y).toBe(9)
    })

    it('should initialize cursor at center if no cursor', () => {
      const store = createStore()
      store.set(editorDimensionsAtom, { width: 100, height: 100 })
      store.set(editorCursorAtom, null)

      store.set(moveCursorAtom, 'up')
      expect(store.get(editorCursorAtom)).toEqual({ x: 50, y: 49 })
    })
  })

  describe('paintAtCursorAtom', () => {
    it('should paint at cursor position', () => {
      const store = createStore()
      const buffer = new Uint8Array([0, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorCursorAtom, { x: 1, y: 1 })
      store.set(editorSelectedInkAtom, 7)

      store.set(paintAtCursorAtom)

      expect(store.get(editorIndexBufferAtom)![3]).toBe(7)
    })

    it('should do nothing if no cursor', () => {
      const store = createStore()
      const buffer = new Uint8Array([0, 0, 0, 0])
      store.set(editorIndexBufferAtom, buffer)
      store.set(editorDimensionsAtom, { width: 2, height: 2 })
      store.set(editorCursorAtom, null)

      store.set(paintAtCursorAtom)

      expect(store.get(editorHistoryAtom)).toHaveLength(0)
    })
  })

  describe('zoom actions', () => {
    it('setZoomAtom should set zoom level', () => {
      const store = createStore()
      store.set(setZoomAtom, 8)
      expect(store.get(editorZoomAtom)).toBe(8)
    })

    it('zoomInAtom should increase zoom', () => {
      const store = createStore()
      store.set(editorZoomAtom, 4)
      store.set(zoomInAtom)
      expect(store.get(editorZoomAtom)).toBe(8)
    })

    it('zoomInAtom should not exceed max zoom', () => {
      const store = createStore()
      store.set(editorZoomAtom, 16)
      store.set(zoomInAtom)
      expect(store.get(editorZoomAtom)).toBe(16)
    })

    it('zoomOutAtom should decrease zoom', () => {
      const store = createStore()
      store.set(editorZoomAtom, 4)
      store.set(zoomOutAtom)
      expect(store.get(editorZoomAtom)).toBe(2)
    })

    it('zoomOutAtom should not go below min zoom', () => {
      const store = createStore()
      store.set(editorZoomAtom, 1)
      store.set(zoomOutAtom)
      expect(store.get(editorZoomAtom)).toBe(1)
    })
  })

  describe('toggleGridAtom', () => {
    it('should toggle grid visibility', () => {
      const store = createStore()
      expect(store.get(editorGridVisibleAtom)).toBe(true)

      store.set(toggleGridAtom)
      expect(store.get(editorGridVisibleAtom)).toBe(false)

      store.set(toggleGridAtom)
      expect(store.get(editorGridVisibleAtom)).toBe(true)
    })
  })

  describe('ink selection actions', () => {
    beforeEach(() => {})

    it('inkCountAtom should return palette length', () => {
      const store = createStore()
      const palette: Vector<'RGB'>[] = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0]
      ]
      store.set(editorBasePaletteAtom, palette)
      expect(store.get(inkCountAtom)).toBe(4)
    })

    it('inkCountAtom should default to 16 if no palette', () => {
      const store = createStore()
      store.set(editorBasePaletteAtom, [])
      expect(store.get(inkCountAtom)).toBe(16)
    })

    it('nextInkAtom should cycle to next ink', () => {
      const store = createStore()
      const palette: Vector<'RGB'>[] = [
        [0, 0, 0],
        [255, 255, 255],
        [255, 0, 0],
        [0, 255, 0]
      ]
      store.set(editorBasePaletteAtom, palette)
      store.set(editorSelectedInkAtom, 2)

      store.set(nextInkAtom)
      expect(store.get(editorSelectedInkAtom)).toBe(3)

      store.set(nextInkAtom)
      expect(store.get(editorSelectedInkAtom)).toBe(0) // Wrap around
    })

    it('prevInkAtom should cycle to previous ink', () => {
      const store = createStore()
      const palette: Vector<'RGB'>[] = [
        [0, 0, 0],
        [255, 255, 255],
        [255, 0, 0],
        [0, 255, 0]
      ]
      store.set(editorBasePaletteAtom, palette)
      store.set(editorSelectedInkAtom, 1)

      store.set(prevInkAtom)
      expect(store.get(editorSelectedInkAtom)).toBe(0)

      store.set(prevInkAtom)
      expect(store.get(editorSelectedInkAtom)).toBe(3) // Wrap around
    })

    it('selectInkAtom should select valid ink', () => {
      const store = createStore()
      const palette: Vector<'RGB'>[] = [
        [0, 0, 0],
        [255, 255, 255],
        [255, 0, 0],
        [0, 255, 0]
      ]
      store.set(editorBasePaletteAtom, palette)

      store.set(selectInkAtom, 2)
      expect(store.get(editorSelectedInkAtom)).toBe(2)
    })

    it('selectInkAtom should ignore invalid ink index', () => {
      const store = createStore()
      const palette: Vector<'RGB'>[] = [
        [0, 0, 0],
        [255, 255, 255]
      ]
      store.set(editorBasePaletteAtom, palette)
      store.set(editorSelectedInkAtom, 0)

      store.set(selectInkAtom, 10)
      expect(store.get(editorSelectedInkAtom)).toBe(0) // Unchanged

      store.set(selectInkAtom, -1)
      expect(store.get(editorSelectedInkAtom)).toBe(0) // Unchanged
    })
  })

  describe('cancelEditModeAtom', () => {
    it('should reset all editor state', () => {
      const store = createStore()
      // Setup initial state
      store.set(editorModeAtom, true)
      store.set(editorIndexBufferAtom, new Uint8Array([1, 2, 3]))
      store.set(editorOriginalBufferAtom, new Uint8Array([0, 0, 0]))
      store.set(editorDimensionsAtom, { width: 3, height: 1 })
      store.set(editorHistoryAtom, [
        { type: 'pixel', edits: [], timestamp: Date.now() }
      ])
      store.set(editorHistoryIndexAtom, 0)
      store.set(editorCursorAtom, { x: 1, y: 0 })

      store.set(cancelEditModeAtom)

      expect(store.get(editorModeAtom)).toBe(false)
      expect(store.get(editorIndexBufferAtom)).toBeNull()
      expect(store.get(editorOriginalBufferAtom)).toBeNull()
      expect(store.get(editorDimensionsAtom)).toBeNull()
      expect(store.get(editorHistoryAtom)).toHaveLength(0)
      expect(store.get(editorHistoryIndexAtom)).toBe(-1)
      expect(store.get(editorCursorAtom)).toBeNull()
    })
  })
})
