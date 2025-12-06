import { createStore } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RasterRange } from '@/libs/pixsaur-raster/types'
import {
  addRasterRangeAtom,
  clearRasterRangesAtom,
  generateRangeId,
  rasterConflictsAtom,
  rasterEnabledAtom,
  rasterRangesAtom,
  removeRasterRangeAtom,
  updateRasterRangeAtom
} from './raster'

describe('Raster Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    // Clear any existing ranges
    store.set(rasterRangesAtom, [])
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

  describe('rasterRangesAtom', () => {
    it('should have empty array as default value', () => {
      const value = store.get(rasterRangesAtom)
      expect(value).toEqual([])
    })

    it('should store ranges correctly', () => {
      const range: RasterRange = {
        id: 'test-1',
        inkIndex: 0,
        startLine: 0,
        endLine: 50,
        color: [255, 0, 0]
      }
      store.set(rasterRangesAtom, [range])
      expect(store.get(rasterRangesAtom)).toEqual([range])
    })
  })

  describe('generateRangeId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateRangeId()
      const id2 = generateRangeId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^raster-\d+-[a-z0-9]+$/)
      expect(id2).toMatch(/^raster-\d+-[a-z0-9]+$/)
    })
  })

  describe('addRasterRangeAtom', () => {
    it('should add a new range with generated ID', () => {
      const newRange = {
        inkIndex: 1,
        startLine: 10,
        endLine: 30,
        color: [0, 255, 0] as [number, number, number]
      }

      const id = store.set(addRasterRangeAtom, newRange)

      expect(id).toMatch(/^raster-\d+-[a-z0-9]+$/)

      const ranges = store.get(rasterRangesAtom)
      expect(ranges).toHaveLength(1)
      expect(ranges[0]).toMatchObject({
        ...newRange,
        id
      })
    })

    it('should append to existing ranges', () => {
      const range1 = {
        inkIndex: 0,
        startLine: 0,
        endLine: 20,
        color: [255, 0, 0] as [number, number, number]
      }
      const range2 = {
        inkIndex: 1,
        startLine: 50,
        endLine: 80,
        color: [0, 255, 0] as [number, number, number]
      }

      store.set(addRasterRangeAtom, range1)
      store.set(addRasterRangeAtom, range2)

      const ranges = store.get(rasterRangesAtom)
      expect(ranges).toHaveLength(2)
    })
  })

  describe('updateRasterRangeAtom', () => {
    it('should update an existing range', () => {
      const id = store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 50,
        color: [255, 0, 0] as [number, number, number]
      })

      const result = store.set(updateRasterRangeAtom, {
        id,
        startLine: 10,
        endLine: 40
      })

      expect(result).toBe(true)

      const ranges = store.get(rasterRangesAtom)
      expect(ranges[0].startLine).toBe(10)
      expect(ranges[0].endLine).toBe(40)
      expect(ranges[0].inkIndex).toBe(0) // unchanged
      expect(ranges[0].color).toEqual([255, 0, 0]) // unchanged
    })

    it('should return false for non-existent range', () => {
      const result = store.set(updateRasterRangeAtom, {
        id: 'non-existent',
        startLine: 10
      })

      expect(result).toBe(false)
    })

    it('should update only the specified fields', () => {
      const id = store.set(addRasterRangeAtom, {
        inkIndex: 2,
        startLine: 0,
        endLine: 100,
        color: [0, 0, 255] as [number, number, number]
      })

      store.set(updateRasterRangeAtom, { id, color: [255, 255, 0] })

      const ranges = store.get(rasterRangesAtom)
      expect(ranges[0].inkIndex).toBe(2)
      expect(ranges[0].startLine).toBe(0)
      expect(ranges[0].endLine).toBe(100)
      expect(ranges[0].color).toEqual([255, 255, 0])
    })
  })

  describe('removeRasterRangeAtom', () => {
    it('should remove a range by ID', () => {
      const id1 = store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 30,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterRangeAtom, {
        inkIndex: 1,
        startLine: 50,
        endLine: 80,
        color: [0, 255, 0] as [number, number, number]
      })

      store.set(removeRasterRangeAtom, id1)

      const ranges = store.get(rasterRangesAtom)
      expect(ranges).toHaveLength(1)
      expect(ranges[0].id).toBe(id2)
    })

    it('should do nothing when removing non-existent ID', () => {
      store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 30,
        color: [255, 0, 0] as [number, number, number]
      })

      store.set(removeRasterRangeAtom, 'non-existent')

      const ranges = store.get(rasterRangesAtom)
      expect(ranges).toHaveLength(1)
    })
  })

  describe('clearRasterRangesAtom', () => {
    it('should clear all ranges', () => {
      store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 30,
        color: [255, 0, 0] as [number, number, number]
      })
      store.set(addRasterRangeAtom, {
        inkIndex: 1,
        startLine: 50,
        endLine: 80,
        color: [0, 255, 0] as [number, number, number]
      })

      expect(store.get(rasterRangesAtom)).toHaveLength(2)

      store.set(clearRasterRangesAtom)

      expect(store.get(rasterRangesAtom)).toHaveLength(0)
    })
  })

  describe('rasterConflictsAtom', () => {
    it('should return empty array when no ranges exist', () => {
      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toEqual([])
    })

    it('should return empty array when ranges do not overlap', () => {
      store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 30,
        color: [255, 0, 0] as [number, number, number]
      })
      store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 31,
        endLine: 60,
        color: [0, 255, 0] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toEqual([])
    })

    it('should detect overlapping ranges with same ink', () => {
      const id1 = store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 50,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 40,
        endLine: 80,
        color: [0, 255, 0] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toContain(id1)
      expect(conflicts).toContain(id2)
      expect(conflicts).toHaveLength(2)
    })

    it('should detect overlapping ranges with different inks', () => {
      const id1 = store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 50,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterRangeAtom, {
        inkIndex: 1,
        startLine: 40,
        endLine: 80,
        color: [0, 255, 0] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toContain(id1)
      expect(conflicts).toContain(id2)
      expect(conflicts).toHaveLength(2)
    })

    it('should detect when one range is completely inside another', () => {
      const id1 = store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 100,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterRangeAtom, {
        inkIndex: 2,
        startLine: 30,
        endLine: 60,
        color: [0, 255, 0] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toContain(id1)
      expect(conflicts).toContain(id2)
      expect(conflicts).toHaveLength(2)
    })

    it('should not flag adjacent ranges as conflicting', () => {
      store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 49,
        color: [255, 0, 0] as [number, number, number]
      })
      store.set(addRasterRangeAtom, {
        inkIndex: 1,
        startLine: 50,
        endLine: 100,
        color: [0, 255, 0] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toEqual([])
    })

    it('should detect multiple overlapping ranges', () => {
      const id1 = store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 50,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterRangeAtom, {
        inkIndex: 1,
        startLine: 40,
        endLine: 80,
        color: [0, 255, 0] as [number, number, number]
      })
      const id3 = store.set(addRasterRangeAtom, {
        inkIndex: 2,
        startLine: 70,
        endLine: 120,
        color: [0, 0, 255] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toContain(id1)
      expect(conflicts).toContain(id2)
      expect(conflicts).toContain(id3)
      expect(conflicts).toHaveLength(3)
    })

    it('should only flag overlapping ranges, not all ranges', () => {
      store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 0,
        endLine: 30,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterRangeAtom, {
        inkIndex: 1,
        startLine: 50,
        endLine: 80,
        color: [0, 255, 0] as [number, number, number]
      })
      const id3 = store.set(addRasterRangeAtom, {
        inkIndex: 2,
        startLine: 70,
        endLine: 120,
        color: [0, 0, 255] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      // Only id2 and id3 overlap
      expect(conflicts).toContain(id2)
      expect(conflicts).toContain(id3)
      expect(conflicts).toHaveLength(2)
    })

    it('should handle ranges with same start and end line (single line)', () => {
      const id1 = store.set(addRasterRangeAtom, {
        inkIndex: 0,
        startLine: 50,
        endLine: 50,
        color: [255, 0, 0] as [number, number, number]
      })
      const id2 = store.set(addRasterRangeAtom, {
        inkIndex: 1,
        startLine: 50,
        endLine: 50,
        color: [0, 255, 0] as [number, number, number]
      })

      const conflicts = store.get(rasterConflictsAtom)
      expect(conflicts).toContain(id1)
      expect(conflicts).toContain(id2)
      expect(conflicts).toHaveLength(2)
    })
  })
})
