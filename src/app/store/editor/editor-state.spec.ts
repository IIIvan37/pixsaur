import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  canRedoAtom,
  canUndoAtom,
  editorBasePaletteAtom,
  editorDimensionsAtom,
  editorHistoryAtom,
  editorHistoryIndexAtom,
  editorIndexBufferAtom,
  editorOriginalBufferAtom,
  editorPixelAspectAtom,
  editorPixelModeAtom,
  editorRasterChangesAtom,
  getLinePaletteAtom,
  hasUnsavedChangesAtom,
  historyCountAtom,
  MAX_HISTORY_SIZE
} from './editor-state'

describe('editor-state', () => {
  describe('editorIndexBufferAtom', () => {
    it('should initialize as null', () => {
      const store = createStore()
      expect(store.get(editorIndexBufferAtom)).toBeNull()
    })

    it('should store a Uint8Array', () => {
      const store = createStore()
      const buffer = new Uint8Array([0, 1, 2, 3])
      store.set(editorIndexBufferAtom, buffer)
      expect(store.get(editorIndexBufferAtom)).toEqual(buffer)
    })
  })

  describe('editorDimensionsAtom', () => {
    it('should initialize as null', () => {
      const store = createStore()
      expect(store.get(editorDimensionsAtom)).toBeNull()
    })

    it('should store dimensions', () => {
      const store = createStore()
      store.set(editorDimensionsAtom, { width: 160, height: 200 })
      expect(store.get(editorDimensionsAtom)).toEqual({
        width: 160,
        height: 200
      })
    })
  })

  describe('editorPixelAspectAtom', () => {
    it('should return aspect ratio for mode 0 (2x wider pixels)', () => {
      const store = createStore()
      store.set(editorPixelModeAtom, 0)
      const aspect = store.get(editorPixelAspectAtom)
      expect(aspect.widthMultiplier).toBe(2)
      expect(aspect.heightMultiplier).toBe(1)
    })

    it('should return aspect ratio for mode 1 (square pixels)', () => {
      const store = createStore()
      store.set(editorPixelModeAtom, 1)
      const aspect = store.get(editorPixelAspectAtom)
      expect(aspect.widthMultiplier).toBe(1)
      expect(aspect.heightMultiplier).toBe(1)
    })

    it('should return aspect ratio for mode 2 (2x taller pixels)', () => {
      const store = createStore()
      store.set(editorPixelModeAtom, 2)
      const aspect = store.get(editorPixelAspectAtom)
      expect(aspect.widthMultiplier).toBe(1)
      expect(aspect.heightMultiplier).toBe(2)
    })
  })

  describe('getLinePaletteAtom', () => {
    it('should return base palette when no raster changes', () => {
      const store = createStore()
      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ]
      store.set(editorBasePaletteAtom, basePalette)
      store.set(editorRasterChangesAtom, [])

      const getLinePalette = store.get(getLinePaletteAtom)
      const palette = getLinePalette(50)

      expect(palette).toEqual(basePalette)
    })

    it('should apply raster changes up to the given line', () => {
      const store = createStore()
      const basePalette: Vector<'RGB'>[] = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ]
      store.set(editorBasePaletteAtom, basePalette)
      store.set(editorRasterChangesAtom, [
        { id: '1', line: 10, inkIndex: 0, color: [128, 128, 128] as Vector },
        { id: '2', line: 20, inkIndex: 1, color: [64, 64, 64] as Vector }
      ])

      const getLinePalette = store.get(getLinePaletteAtom)

      // Before any changes
      const palette5 = getLinePalette(5)
      expect(palette5[0]).toEqual([255, 0, 0])
      expect(palette5[1]).toEqual([0, 255, 0])

      // After first change
      const palette15 = getLinePalette(15)
      expect(palette15[0]).toEqual([128, 128, 128])
      expect(palette15[1]).toEqual([0, 255, 0])

      // After both changes
      const palette25 = getLinePalette(25)
      expect(palette25[0]).toEqual([128, 128, 128])
      expect(palette25[1]).toEqual([64, 64, 64])
    })
  })

  describe('canUndoAtom', () => {
    it('should return false when history index is -1', () => {
      const store = createStore()
      store.set(editorHistoryIndexAtom, -1)
      expect(store.get(canUndoAtom)).toBe(false)
    })

    it('should return true when history index >= 0', () => {
      const store = createStore()
      store.set(editorHistoryIndexAtom, 0)
      expect(store.get(canUndoAtom)).toBe(true)
    })
  })

  describe('canRedoAtom', () => {
    it('should return false when at end of history', () => {
      const store = createStore()
      store.set(editorHistoryAtom, [
        { type: 'pixel', edits: [], timestamp: Date.now() }
      ])
      store.set(editorHistoryIndexAtom, 0)
      expect(store.get(canRedoAtom)).toBe(false)
    })

    it('should return true when not at end of history', () => {
      const store = createStore()
      store.set(editorHistoryAtom, [
        { type: 'pixel', edits: [], timestamp: Date.now() },
        { type: 'pixel', edits: [], timestamp: Date.now() }
      ])
      store.set(editorHistoryIndexAtom, 0)
      expect(store.get(canRedoAtom)).toBe(true)
    })
  })

  describe('historyCountAtom', () => {
    it('should return 0 when history index is -1', () => {
      const store = createStore()
      store.set(editorHistoryIndexAtom, -1)
      expect(store.get(historyCountAtom)).toBe(0)
    })

    it('should return correct count based on index', () => {
      const store = createStore()
      store.set(editorHistoryIndexAtom, 4)
      expect(store.get(historyCountAtom)).toBe(5)
    })
  })

  describe('hasUnsavedChangesAtom', () => {
    it('should return false when no changes', () => {
      const store = createStore()
      store.set(editorHistoryIndexAtom, -1)
      expect(store.get(hasUnsavedChangesAtom)).toBe(false)
    })

    it('should return true when changes exist', () => {
      const store = createStore()
      store.set(editorHistoryIndexAtom, 2)
      expect(store.get(hasUnsavedChangesAtom)).toBe(true)
    })
  })

  describe('editorOriginalBufferAtom', () => {
    it('should initialize as null', () => {
      const store = createStore()
      expect(store.get(editorOriginalBufferAtom)).toBeNull()
    })
  })

  describe('MAX_HISTORY_SIZE', () => {
    it('should be 100', () => {
      expect(MAX_HISTORY_SIZE).toBe(100)
    })
  })
})
