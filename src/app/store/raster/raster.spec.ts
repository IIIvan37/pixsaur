import { createStore } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import {
  addRasterChangeAtom,
  clearRasterChangesAtom,
  generateChangeId,
  rasterChangesAtom,
  rasterConflictsAtom,
  rasterEnabledAtom,
  removeRasterChangeAtom,
  updateRasterChangeAtom
} from './raster'

describe('Raster Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    // Clear any existing changes
    store.set(rasterChangesAtom, [])
  })

  describe('rasterEnabledAtom', () => {
    it('should have false as default value', () => {
      const value = store.get(rasterEnabledAtom)
      expect(value).toBe(false)
    })

    it('should allow toggling enabled state', () => {
      store.set(rasterEnabledAtom, true)
      expect(store.get(rasterEnabledAtom)).toBe(true)

      store.set(rasterEnabledAtom, false)
      expect(store.get(rasterEnabledAtom)).toBe(false)
    })
  })

  describe('rasterChangesAtom', () => {
    it('should have empty array as default value', () => {
      const value = store.get(rasterChangesAtom)
      expect(value).toEqual([])
    })

    it('should store changes correctly', () => {
      const change: RasterChange = {
        id: 'test-1',
        inkIndex: 0,
        line: 50,
        color: [255, 0, 0]
      }
      store.set(rasterChangesAtom, [change])
      expect(store.get(rasterChangesAtom)).toEqual([change])
    })
  })

  describe('generateChangeId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateChangeId()
      const id2 = generateChangeId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^raster-\d+-[a-z0-9]+$/)
      expect(id2).toMatch(/^raster-\d+-[a-z0-9]+$/)
    })
  })

  describe('addRasterChangeAtom', () => {
    it('should add a new change with generated ID', () => {
      const newChange = {
        inkIndex: 1,
        line: 10,
        color: [0, 255, 0] as [number, number, number]
      }

      const id = store.set(addRasterChangeAtom, newChange)

      expect(id).toMatch(/^raster-\d+-[a-z0-9]+$/)

      const changes = store.get(rasterChangesAtom)
      expect(changes).toHaveLength(1)
      expect(changes[0]).toMatchObject({
        ...newChange,
        id
      })
    })

    it('should append to existing changes', () => {
      const change1 = {
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0] as [number, number, number]
      }
      const change2 = {
        inkIndex: 1,
        line: 50,
        color: [0, 255, 0] as [number, number, number]
      }

      store.set(addRasterChangeAtom, change1)
      store.set(addRasterChangeAtom, change2)

      const changes = store.get(rasterChangesAtom)
      expect(changes).toHaveLength(2)
    })
  })

  describe('updateRasterChangeAtom', () => {
    it('should update an existing change', () => {
      const id = store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0] as [number, number, number]
      })

      const result = store.set(updateRasterChangeAtom, {
        id,
        line: 10
      })

      expect(result).toBe(true)

      const changes = store.get(rasterChangesAtom)
      expect(changes[0].line).toBe(10)
      expect(changes[0].inkIndex).toBe(0) // unchanged
      expect(changes[0].color).toEqual([255, 0, 0]) // unchanged
    })

    it('should return false for non-existent change', () => {
      const result = store.set(updateRasterChangeAtom, {
        id: 'non-existent',
        line: 10
      })

      expect(result).toBe(false)
    })

    it('should update only the specified fields', () => {
      const id = store.set(addRasterChangeAtom, {
        inkIndex: 2,
        line: 0,
        color: [0, 0, 255] as [number, number, number]
      })

      store.set(updateRasterChangeAtom, { id, color: [255, 255, 0] })

      const changes = store.get(rasterChangesAtom)
      expect(changes[0].inkIndex).toBe(2)
      expect(changes[0].line).toBe(0)
      expect(changes[0].color).toEqual([255, 255, 0])
    })
  })

  describe('removeRasterChangeAtom', () => {
    it('should remove a change by ID', () => {
      const id1 = store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterChangeAtom, {
        inkIndex: 1,
        line: 50,
        color: [0, 255, 0] as [number, number, number]
      })

      store.set(removeRasterChangeAtom, id1)

      const changes = store.get(rasterChangesAtom)
      expect(changes).toHaveLength(1)
      expect(changes[0].id).toBe(id2)
    })

    it('should do nothing when removing non-existent ID', () => {
      store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0] as [number, number, number]
      })

      store.set(removeRasterChangeAtom, 'non-existent')

      const changes = store.get(rasterChangesAtom)
      expect(changes).toHaveLength(1)
    })
  })

  describe('clearRasterChangesAtom', () => {
    it('should clear all changes', () => {
      store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0] as [number, number, number]
      })
      store.set(addRasterChangeAtom, {
        inkIndex: 1,
        line: 50,
        color: [0, 255, 0] as [number, number, number]
      })

      expect(store.get(rasterChangesAtom)).toHaveLength(2)

      store.set(clearRasterChangesAtom)

      expect(store.get(rasterChangesAtom)).toHaveLength(0)
    })
  })

  describe('rasterConflictsAtom', () => {
    it('should return empty array when no changes exist', () => {
      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toEqual([])
    })

    it('should return empty array when changes do not conflict', () => {
      store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0] as [number, number, number]
      })
      store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 60,
        color: [0, 255, 0] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toEqual([])
    })

    it('should detect conflicts: same ink, same line', () => {
      const id1 = store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 50,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 50,
        color: [0, 255, 0] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toContain(id1)
      expect(conflicts).toContain(id2)
      expect(conflicts).toHaveLength(2)
    })

    it('should not detect conflicts: different inks, same line', () => {
      store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 50,
        color: [255, 0, 0] as [number, number, number]
      })
      store.set(addRasterChangeAtom, {
        inkIndex: 1,
        line: 50,
        color: [0, 255, 0] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      // Different inks on same line is OK
      expect(conflicts).toEqual([])
    })

    it('should not flag same ink, different line as conflict', () => {
      store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 30,
        color: [255, 0, 0] as [number, number, number]
      })
      store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 60,
        color: [0, 255, 0] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toEqual([])
    })

    it('should detect multiple conflicting changes', () => {
      const id1 = store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 50,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 50,
        color: [0, 255, 0] as [number, number, number]
      })
      const id3 = store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 50,
        color: [0, 0, 255] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toContain(id1)
      expect(conflicts).toContain(id2)
      expect(conflicts).toContain(id3)
      expect(conflicts).toHaveLength(3)
    })

    it('should only flag conflicting changes, not all changes', () => {
      store.set(addRasterChangeAtom, {
        inkIndex: 0,
        line: 0,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterChangeAtom, {
        inkIndex: 1,
        line: 50,
        color: [0, 255, 0] as [number, number, number]
      })
      const id3 = store.set(addRasterChangeAtom, {
        inkIndex: 1,
        line: 50,
        color: [0, 0, 255] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      // Only id2 and id3 conflict (same ink, same line)
      expect(conflicts).toContain(id2)
      expect(conflicts).toContain(id3)
      expect(conflicts).toHaveLength(2)
    })
  })
})
