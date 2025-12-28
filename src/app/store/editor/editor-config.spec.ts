import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import {
  editorCursorAtom,
  editorGridVisibleAtom,
  editorHoveredPixelAtom,
  editorModeAtom,
  editorSelectedInkAtom,
  editorViewportAtom,
  editorZoomAtom,
  type ZoomLevel
} from './editor-config'

describe('editor-config', () => {
  describe('editorModeAtom', () => {
    it('should initialize as false', () => {
      const store = createStore()
      expect(store.get(editorModeAtom)).toBe(false)
    })

    it('should toggle mode', () => {
      const store = createStore()
      store.set(editorModeAtom, true)
      expect(store.get(editorModeAtom)).toBe(true)
    })
  })

  describe('editorZoomAtom', () => {
    it('should initialize at zoom level 4', () => {
      const store = createStore()
      expect(store.get(editorZoomAtom)).toBe(4)
    })

    it('should accept valid zoom levels', () => {
      const store = createStore()
      const validLevels: ZoomLevel[] = [1, 2, 4, 8, 16]

      for (const level of validLevels) {
        store.set(editorZoomAtom, level)
        expect(store.get(editorZoomAtom)).toBe(level)
      }
    })
  })

  describe('editorViewportAtom', () => {
    it('should initialize at origin', () => {
      const store = createStore()
      expect(store.get(editorViewportAtom)).toEqual({ x: 0, y: 0 })
    })

    it('should update viewport position', () => {
      const store = createStore()
      store.set(editorViewportAtom, { x: 50, y: 100 })
      expect(store.get(editorViewportAtom)).toEqual({ x: 50, y: 100 })
    })
  })

  describe('editorGridVisibleAtom', () => {
    it('should initialize as true', () => {
      const store = createStore()
      expect(store.get(editorGridVisibleAtom)).toBe(true)
    })

    it('should toggle grid visibility', () => {
      const store = createStore()
      store.set(editorGridVisibleAtom, false)
      expect(store.get(editorGridVisibleAtom)).toBe(false)
    })
  })

  describe('editorSelectedInkAtom', () => {
    it('should initialize at ink 0', () => {
      const store = createStore()
      expect(store.get(editorSelectedInkAtom)).toBe(0)
    })

    it('should update selected ink', () => {
      const store = createStore()
      store.set(editorSelectedInkAtom, 5)
      expect(store.get(editorSelectedInkAtom)).toBe(5)
    })
  })

  describe('editorCursorAtom', () => {
    it('should initialize as null', () => {
      const store = createStore()
      expect(store.get(editorCursorAtom)).toBeNull()
    })

    it('should update cursor position', () => {
      const store = createStore()
      store.set(editorCursorAtom, { x: 10, y: 20 })
      expect(store.get(editorCursorAtom)).toEqual({ x: 10, y: 20 })
    })

    it('should accept null to deactivate cursor', () => {
      const store = createStore()
      store.set(editorCursorAtom, { x: 10, y: 20 })
      store.set(editorCursorAtom, null)
      expect(store.get(editorCursorAtom)).toBeNull()
    })
  })

  describe('editorHoveredPixelAtom', () => {
    it('should initialize as null', () => {
      const store = createStore()
      expect(store.get(editorHoveredPixelAtom)).toBeNull()
    })

    it('should update hovered pixel position', () => {
      const store = createStore()
      store.set(editorHoveredPixelAtom, { x: 15, y: 25 })
      expect(store.get(editorHoveredPixelAtom)).toEqual({ x: 15, y: 25 })
    })
  })
})
