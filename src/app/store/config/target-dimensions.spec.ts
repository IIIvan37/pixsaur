import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'

import {
  TARGET_DIMENSION_PRESETS,
  targetDimensionsAtom,
  targetDimensionsValidationAtom,
  modeAtom,
  setTargetDimensionsAtom,
} from './config'

describe('Target Dimensions Atoms', () => {
  describe('targetDimensionsAtom', () => {
    it('should have default dimensions', () => {
      const store = createStore()
      const dimensions = store.get(targetDimensionsAtom)

      expect(dimensions.width).toBe(160)
      expect(dimensions.height).toBe(200)
    })
  })

  describe('setTargetDimensionsAtom', () => {
    it('should update width', () => {
      const store = createStore()

      store.set(setTargetDimensionsAtom, { width: 320 })
      const dimensions = store.get(targetDimensionsAtom)

      expect(dimensions.width).toBe(320)
      expect(dimensions.height).toBe(200)
    })

    it('should update height', () => {
      const store = createStore()

      store.set(setTargetDimensionsAtom, { height: 256 })
      const dimensions = store.get(targetDimensionsAtom)

      expect(dimensions.width).toBe(160)
      expect(dimensions.height).toBe(256)
    })

    it('should update both dimensions', () => {
      const store = createStore()

      store.set(setTargetDimensionsAtom, { width: 256, height: 256 })
      const dimensions = store.get(targetDimensionsAtom)

      expect(dimensions.width).toBe(256)
      expect(dimensions.height).toBe(256)
    })
  })

  describe('targetDimensionsValidationAtom', () => {
    it('should validate dimensions for mode 0', () => {
      const store = createStore()
      store.set(modeAtom, '0')
      store.set(setTargetDimensionsAtom, { width: 160, height: 200 })

      const validation = store.get(targetDimensionsValidationAtom)

      expect(validation.valid).toBe(true)
      expect(validation.widthInBytes).toBe(80)
      expect(validation.bytes).toBe(16000)
    })

    it('should detect invalid width in mode 0', () => {
      const store = createStore()
      store.set(modeAtom, '0')
      store.set(setTargetDimensionsAtom, { width: 162, height: 200 })

      const validation = store.get(targetDimensionsValidationAtom)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    it('should detect invalid height in mode 1', () => {
      const store = createStore()
      store.set(modeAtom, '1')
      store.set(setTargetDimensionsAtom, { width: 320, height: 201 })

      const validation = store.get(targetDimensionsValidationAtom)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Height must be multiple of 8 (CPC interlacing)')
    })

    it('should validate dimensions in mode 2', () => {
      const store = createStore()
      store.set(modeAtom, '2')
      store.set(setTargetDimensionsAtom, { width: 640, height: 200 })

      const validation = store.get(targetDimensionsValidationAtom)

      expect(validation.valid).toBe(true)
      expect(validation.widthInBytes).toBe(80)
      expect(validation.bytes).toBe(16000)
    })

    it('should detect memory overflow', () => {
      const store = createStore()
      store.set(modeAtom, '0')
      store.set(setTargetDimensionsAtom, { width: 512, height: 512 })

      const validation = store.get(targetDimensionsValidationAtom)

      expect(validation.valid).toBe(false)
      expect(validation.errors.some((e) => e.includes('64 Ko limit'))).toBe(true)
    })
  })

  describe('TARGET_DIMENSION_PRESETS', () => {
    it('should have presets for all modes', () => {
      expect(TARGET_DIMENSION_PRESETS.mode0).toBeDefined()
      expect(TARGET_DIMENSION_PRESETS.mode1).toBeDefined()
      expect(TARGET_DIMENSION_PRESETS.mode2).toBeDefined()
    })

    it('should have Standard and Overscan presets for mode 0', () => {
      const presets = TARGET_DIMENSION_PRESETS.mode0
      expect(presets.some((p) => p.name === 'Standard')).toBe(true)
      expect(presets.some((p) => p.name === 'Overscan')).toBe(true)

      const standard = presets.find((p) => p.name === 'Standard')
      expect(standard?.width).toBe(160)
      expect(standard?.height).toBe(200)

      const overscan = presets.find((p) => p.name === 'Overscan')
      expect(overscan?.width).toBe(192)
      expect(overscan?.height).toBe(280)
    })

    it('should have Standard and Overscan presets for mode 1', () => {
      const presets = TARGET_DIMENSION_PRESETS.mode1
      const standard = presets.find((p) => p.name === 'Standard')
      const overscan = presets.find((p) => p.name === 'Overscan')

      expect(standard?.width).toBe(320)
      expect(standard?.height).toBe(200)
      expect(overscan?.width).toBe(384)
      expect(overscan?.height).toBe(280)
    })

    it('should have Standard and Overscan presets for mode 2', () => {
      const presets = TARGET_DIMENSION_PRESETS.mode2
      const standard = presets.find((p) => p.name === 'Standard')
      const overscan = presets.find((p) => p.name === 'Overscan')

      expect(standard?.width).toBe(640)
      expect(standard?.height).toBe(200)
      expect(overscan?.width).toBe(768)
      expect(overscan?.height).toBe(280)
    })

    it('should have valid mode 0 presets', () => {
      for (const preset of TARGET_DIMENSION_PRESETS.mode0) {
        expect(preset.width % 4).toBe(0)
        expect(preset.height % 8).toBe(0)
        expect(preset.name).toBeTruthy()
      }
    })

    it('should have valid mode 1 presets', () => {
      for (const preset of TARGET_DIMENSION_PRESETS.mode1) {
        expect(preset.width % 8).toBe(0)
        expect(preset.height % 8).toBe(0)
        expect(preset.name).toBeTruthy()
      }
    })

    it('should have valid mode 2 presets', () => {
      for (const preset of TARGET_DIMENSION_PRESETS.mode2) {
        expect(preset.width % 16).toBe(0)
        expect(preset.height % 8).toBe(0)
        expect(preset.name).toBeTruthy()
      }
    })
  })
})
