import { createStore } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { dimensionPresetAtom, pixelModeAtom } from '../../config/config'
import {
  lockedSlotsAtom,
  lockedVectorsAtom,
  onSetColorAtom,
  onToggleLockAtom,
  setReducedPaletteAtom,
  userPaletteAtom
} from '../palette'
import type { PaletteSlot } from '../types'

describe('Palette Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  describe('User Palette Atom', () => {
    it('should initialize with 16 empty slots', () => {
      const palette = store.get(userPaletteAtom)
      expect(palette).toHaveLength(16)
      expect(
        palette.every((slot) => slot.color === null && slot.locked === false)
      ).toBe(true)
    })

    it('should allow setting palette with custom slots', () => {
      const customPalette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: true },
        { color: [0, 255, 0], locked: false },
        ...new Array(14).fill({ color: null, locked: false })
      ]
      store.set(userPaletteAtom, customPalette)
      expect(store.get(userPaletteAtom)).toEqual(customPalette)
    })
  })

  describe('Set Reduced Palette Atom', () => {
    beforeEach(() => {
      // Set up mode 0 (16 colors) for testing
      store.set(pixelModeAtom, 0)
      store.set(dimensionPresetAtom, 'standard')
    })

    it('should set reduced palette when no slots are locked', () => {
      const reducedColors: Vector<'RGB'>[] = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ]

      store.set(setReducedPaletteAtom, reducedColors)

      const palette = store.get(userPaletteAtom)
      expect(palette[0]).toEqual({ color: [255, 0, 0], locked: false })
      expect(palette[1]).toEqual({ color: [0, 255, 0], locked: false })
      expect(palette[2]).toEqual({ color: [0, 0, 255], locked: false })
      expect(
        palette
          .slice(3, 16)
          .every((slot) => slot.color === null && !slot.locked)
      ).toBe(true)
    })

    it('should preserve locked slots when setting reduced palette', () => {
      // Set up initial palette with some locked slots
      const initialPalette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: true },
        { color: [0, 255, 0], locked: false },
        ...new Array(14).fill({ color: null, locked: false })
      ]
      store.set(userPaletteAtom, initialPalette)

      const reducedColors: Vector<'RGB'>[] = [
        [0, 0, 255], // This should be filtered out as it's already locked
        [255, 255, 0], // This should be added
        [255, 0, 255] // This should be added
      ]

      store.set(setReducedPaletteAtom, reducedColors)

      const palette = store.get(userPaletteAtom)
      // Locked slot should be preserved
      expect(palette[0]).toEqual({ color: [255, 0, 0], locked: true })
      // Non-locked slots should get new colors, skipping the already locked one
      expect(palette[1]).toEqual({ color: [0, 0, 255], locked: false })
      expect(palette[2]).toEqual({ color: [255, 255, 0], locked: false })
    })

    it('should respect mode color limits', () => {
      // Set up mode 1 (4 colors)
      store.set(pixelModeAtom, 1)
      store.set(dimensionPresetAtom, 'standard')

      const reducedColors: Vector<'RGB'>[] = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0],
        [255, 0, 255] // This should be ignored due to color limit
      ]

      store.set(setReducedPaletteAtom, reducedColors)

      const palette = store.get(userPaletteAtom)
      expect(palette.slice(0, 4).every((slot) => slot.color !== null)).toBe(
        true
      )
      expect(
        palette
          .slice(4, 16)
          .every((slot) => slot.color === null && !slot.locked)
      ).toBe(true)
    })

    it('should filter out colors that are already locked', () => {
      // Set up initial palette with locked colors
      const initialPalette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: true },
        { color: [0, 255, 0], locked: true },
        ...Array(14).fill({ color: null, locked: false })
      ]
      store.set(userPaletteAtom, initialPalette)

      const reducedColors: Vector<'RGB'>[] = [
        [255, 0, 0], // Already locked, should be filtered out
        [0, 255, 0], // Already locked, should be filtered out
        [0, 0, 255], // New color, should be added
        [255, 255, 0] // New color, should be added
      ]

      store.set(setReducedPaletteAtom, reducedColors)

      const palette = store.get(userPaletteAtom)
      // Locked slots preserved
      expect(palette[0]).toEqual({ color: [255, 0, 0], locked: true })
      expect(palette[1]).toEqual({ color: [0, 255, 0], locked: true })
      // New colors added to available slots
      expect(palette[2]).toEqual({ color: [0, 0, 255], locked: false })
      expect(palette[3]).toEqual({ color: [255, 255, 0], locked: false })
    })
  })

  describe('Toggle Lock Atom', () => {
    it('should toggle lock state from false to true', () => {
      store.set(onToggleLockAtom, 0)
      const palette = store.get(userPaletteAtom)
      expect(palette[0].locked).toBe(true)
    })

    it('should toggle lock state from true to false', () => {
      // First set to locked
      store.set(onToggleLockAtom, 0)
      expect(store.get(userPaletteAtom)[0].locked).toBe(true)

      // Then toggle back
      store.set(onToggleLockAtom, 0)
      expect(store.get(userPaletteAtom)[0].locked).toBe(false)
    })

    it('should not affect other slots when toggling', () => {
      store.set(onToggleLockAtom, 0)
      const palette = store.get(userPaletteAtom)
      expect(palette[0].locked).toBe(true)
      expect(palette[1].locked).toBe(false)
      expect(palette[15].locked).toBe(false)
    })

    it('should handle toggling any slot index', () => {
      store.set(onToggleLockAtom, 15)
      const palette = store.get(userPaletteAtom)
      expect(palette[15].locked).toBe(true)
      expect(palette[0].locked).toBe(false)
    })
  })

  describe('Set Color Atom', () => {
    it('should set color and lock the slot', () => {
      const color = {
        vector: [255, 128, 64] as Vector<'RGB'>
      }

      store.set(onSetColorAtom, { index: 0, color })

      const palette = store.get(userPaletteAtom)
      expect(palette[0]).toEqual({
        color: [255, 128, 64],
        locked: true
      })
    })

    it('should overwrite existing color and set locked', () => {
      // Set a color and verify it's set and locked
      store.set(onSetColorAtom, {
        index: 0,
        color: { vector: [255, 0, 0] }
      })

      const palette = store.get(userPaletteAtom)
      expect(palette[0]).toEqual({
        color: [255, 0, 0],
        locked: true
      })
    })

    it('should not affect other slots', () => {
      store.set(onSetColorAtom, {
        index: 0,
        color: { vector: [255, 0, 0] }
      })

      const palette = store.get(userPaletteAtom)
      expect(palette[0]).toEqual({ color: [255, 0, 0], locked: true })
      expect(palette[1]).toEqual({ color: null, locked: false })
    })
  })

  describe('Locked Vectors Atom', () => {
    it('should return empty array when no slots are locked', () => {
      const lockedVectors = store.get(lockedVectorsAtom)
      expect(lockedVectors).toEqual([])
    })

    it('should return locked vectors within mode color limit', () => {
      // Set up mode 1 (4 colors)
      store.set(pixelModeAtom, 1)
      store.set(dimensionPresetAtom, 'standard')

      // Set up palette with some locked slots
      const palette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: true },
        { color: [0, 255, 0], locked: false },
        { color: [0, 0, 255], locked: true },
        { color: [255, 255, 0], locked: true },
        { color: [255, 0, 255], locked: true }, // This should be ignored (beyond mode limit)
        ...new Array(11).fill({ color: null, locked: false })
      ]
      store.set(userPaletteAtom, palette)

      const lockedVectors = store.get(lockedVectorsAtom)
      expect(lockedVectors).toEqual([
        [255, 0, 0],
        [0, 0, 255],
        [255, 255, 0]
      ])
    })

    it('should return all locked vectors for mode 0 (16 colors)', () => {
      // Set up mode 0 (16 colors)
      store.set(pixelModeAtom, 0)
      store.set(dimensionPresetAtom, 'standard')

      // Set up palette with locked slots
      const palette: PaletteSlot[] = new Array(16).fill(null).map((_, i) => ({
        color: [i * 15, 128, 255 - i * 15],
        locked: i < 5 // Lock first 5 slots
      }))
      store.set(userPaletteAtom, palette)

      const lockedVectors = store.get(lockedVectorsAtom)
      expect(lockedVectors).toHaveLength(5)
      expect(lockedVectors[0]).toEqual([0, 128, 255])
      expect(lockedVectors[4]).toEqual([60, 128, 195])
    })

    it('should filter out null colors', () => {
      // Set up palette with locked slot but null color
      const palette: PaletteSlot[] = [
        { color: null, locked: true },
        { color: [255, 0, 0], locked: true },
        ...new Array(14).fill({ color: null, locked: false })
      ]
      store.set(userPaletteAtom, palette)

      const lockedVectors = store.get(lockedVectorsAtom)
      expect(lockedVectors).toEqual([null, [255, 0, 0]])
    })
  })

  describe('Locked Slots Atom', () => {
    it('should initialize as empty object', () => {
      const lockedSlots = store.get(lockedSlotsAtom)
      expect(lockedSlots).toEqual({})
    })

    it('should allow setting locked slots', () => {
      store.set(lockedSlotsAtom, {
        0: [255, 0, 0],
        2: [0, 255, 0]
      })

      expect(store.get(lockedSlotsAtom)).toEqual({
        0: [255, 0, 0],
        2: [0, 255, 0]
      })
    })
  })
})
