import { createStore } from 'jotai'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { userPaletteAtom } from '../../palette/palette'
import {
  centerImageAtom,
  clearLastChangedKeyAtom,
  // Color and dithering atoms
  colorSpaceAtom,
  // Other atoms
  configAtom,
  // Hardware atoms
  cpcHardwareAtom,
  customDimensionsAtom,
  dimensionPresetAtom,
  ditheringAtom,
  // Derived atoms
  effectiveModeConfigAtom,
  horizontalSmoothingAtom,
  modeAtom,
  // Basic atoms
  pixelModeAtom,
  processorTypeAtom,
  resetImageAdjustmentsAtom,
  // Resize atoms
  resizeModeAtom,
  setColorSpaceAtom,
  setComponentAtom,
  setCpcHardwareAtom,
  setCustomDimensionsAtom,
  setDimensionPresetAtom,
  setDitheringAtom,
  setModeAtom,
  // Setter atoms
  setPixelModeAtom,
  setProcessorTypeAtom,
  setResizeModeAtom,
  // Processing atoms
  smoothingAtom,
  // Constants
  TARGET_DIMENSION_PRESETS
} from '../config'
import type { CustomDimensions } from '../types'

describe('Config Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Basic Configuration Atoms', () => {
    it('should initialize pixelModeAtom with default value', () => {
      const pixelMode = store.get(pixelModeAtom)
      expect(pixelMode).toBe(0)
    })

    it('should initialize dimensionPresetAtom with default value', () => {
      const dimensionPreset = store.get(dimensionPresetAtom)
      expect(dimensionPreset).toBe('standard')
    })

    it('should initialize customDimensionsAtom with default values', () => {
      const customDimensions = store.get(customDimensionsAtom)
      expect(customDimensions).toEqual({
        width: 160,
        height: 200
      })
    })
  })

  describe('Derived Mode Atom', () => {
    it('should initialize modeAtom with default value', () => {
      const mode = store.get(modeAtom)
      expect(mode).toBe('0')
    })

    it('should allow setting modeAtom directly', () => {
      store.set(modeAtom, '1')
      expect(store.get(modeAtom)).toBe('1')
    })
  })

  describe('Effective Mode Configuration', () => {
    it('should return standard mode config for standard preset', () => {
      store.set(pixelModeAtom, 1)
      store.set(dimensionPresetAtom, 'standard')
      const config = store.get(effectiveModeConfigAtom)
      expect(config).toEqual({
        overscan: false,
        mode: 1,
        width: 320,
        height: 200,
        nColors: 4,
        scaleX: 1,
        scaleY: 1
      })
    })

    it('should return overscan mode config for overscan preset', () => {
      store.set(pixelModeAtom, 2)
      store.set(dimensionPresetAtom, 'overscan')
      const config = store.get(effectiveModeConfigAtom)
      expect(config).toEqual({
        overscan: true,
        mode: 2,
        width: 768,
        height: 280,
        nColors: 2,
        scaleX: 1,
        scaleY: 2
      })
    })

    it('should return custom mode config for custom preset', () => {
      store.set(pixelModeAtom, 0)
      store.set(dimensionPresetAtom, 'custom')
      store.set(customDimensionsAtom, { width: 400, height: 250 })
      const config = store.get(effectiveModeConfigAtom)
      expect(config).toEqual({
        overscan: false,
        mode: 0,
        width: 400,
        height: 250,
        nColors: 16,
        scaleX: 2,
        scaleY: 1
      })
    })
  })

  describe('Mode Setter Atoms', () => {
    it('should set pixel mode with setPixelModeAtom', () => {
      store.set(setPixelModeAtom, 2)
      expect(store.get(pixelModeAtom)).toBe(2)
    })

    it('should set dimension preset with setDimensionPresetAtom', () => {
      store.set(setDimensionPresetAtom, 'overscan')
      expect(store.get(dimensionPresetAtom)).toBe('overscan')
    })

    it('should set custom dimensions with setCustomDimensionsAtom', () => {
      const newDimensions: CustomDimensions = { width: 640, height: 400 }
      store.set(setCustomDimensionsAtom, newDimensions)
      expect(store.get(customDimensionsAtom)).toEqual(newDimensions)
    })

    it('should set mode with setModeAtom', () => {
      store.set(setModeAtom, '1-overscan')
      expect(store.get(modeAtom)).toBe('1-overscan')
    })
  })

  describe('Custom Dimension Adjustment Logic', () => {
    it('should adjust width when switching pixel mode in custom dimensions', () => {
      // Set up custom dimensions with mode 1 first
      store.set(pixelModeAtom, 1)
      store.set(dimensionPresetAtom, 'custom')
      store.set(customDimensionsAtom, { width: 320, height: 200 })

      // Switch from mode 1 (8 pixels/byte) to mode 0 (4 pixels/byte)
      store.set(setPixelModeAtom, 0)

      // Width should be adjusted: 320 / 8 * 4 = 160
      expect(store.get(customDimensionsAtom)).toEqual({
        width: 160,
        height: 200
      })
    })

    it('should clamp adjusted width to valid range', () => {
      store.set(dimensionPresetAtom, 'custom')
      store.set(customDimensionsAtom, { width: 4, height: 200 })

      // Switch from mode 0 (4 pixels/byte) to mode 2 (16 pixels/byte)
      // This results in: 4 / 4 * 16 = 16, which is within valid range
      store.set(setPixelModeAtom, 2)

      expect(store.get(customDimensionsAtom).width).toBe(16)
    })

    it('should not adjust dimensions when not in custom mode', () => {
      store.set(dimensionPresetAtom, 'standard')
      store.set(customDimensionsAtom, { width: 320, height: 200 })

      store.set(setPixelModeAtom, 2)

      // Custom dimensions should remain unchanged
      expect(store.get(customDimensionsAtom)).toEqual({
        width: 320,
        height: 200
      })
    })
  })

  describe('Dimension Preset Switching', () => {
    it('should inherit current dimensions when switching to custom', () => {
      store.set(pixelModeAtom, 1)
      store.set(dimensionPresetAtom, 'standard')

      store.set(setDimensionPresetAtom, 'custom')

      expect(store.get(customDimensionsAtom)).toEqual({
        width: 320,
        height: 200
      })
    })

    it('should inherit overscan dimensions when switching to custom from overscan', () => {
      store.set(pixelModeAtom, 2)
      store.set(dimensionPresetAtom, 'overscan')

      store.set(setDimensionPresetAtom, 'custom')

      expect(store.get(customDimensionsAtom)).toEqual({
        width: 768,
        height: 280
      })
    })
  })

  describe('Color and Dithering Atoms', () => {
    it('should initialize colorSpaceAtom with default value', () => {
      const colorSpace = store.get(colorSpaceAtom)
      expect(colorSpace).toBe('RGB')
    })

    it('should initialize ditheringAtom with default values', () => {
      const dithering = store.get(ditheringAtom)
      expect(dithering).toEqual({
        mode: 'floydSteinberg',
        intensity: 0.5
      })
    })

    it('should update dithering with partial updates using setDitheringAtom', () => {
      store.set(setDitheringAtom, { intensity: 0.8 })
      expect(store.get(ditheringAtom)).toEqual({
        mode: 'floydSteinberg',
        intensity: 0.8
      })

      store.set(setDitheringAtom, { mode: 'bayer4x4' })
      expect(store.get(ditheringAtom)).toEqual({
        mode: 'bayer4x4',
        intensity: 0.8
      })
    })

    it('should set color space with setColorSpaceAtom', () => {
      store.set(setColorSpaceAtom, 'RGB')
      expect(store.get(colorSpaceAtom)).toBe('RGB')
    })
  })

  describe('Processing Atoms', () => {
    it('should initialize processing atoms with default values', () => {
      expect(store.get(smoothingAtom)).toBe(false)
      expect(store.get(horizontalSmoothingAtom)).toBe(false)
      expect(store.get(processorTypeAtom)).toBe('gpu')
    })

    it('should set processor type with setProcessorTypeAtom', () => {
      store.set(setProcessorTypeAtom, 'cpu')
      expect(store.get(processorTypeAtom)).toBe('cpu')
    })
  })

  describe('CPC Hardware Atoms', () => {
    it('should initialize cpcHardwareAtom with default value', () => {
      const hardware = store.get(cpcHardwareAtom)
      expect(hardware).toBe('classic')
    })

    it('should set CPC hardware with setCpcHardwareAtom', () => {
      store.set(setCpcHardwareAtom, 'plus')
      expect(store.get(cpcHardwareAtom)).toBe('plus')
    })

    it('should unlock all palette colors when switching CPC hardware', () => {
      // Set up a palette with some locked colors
      const initialPalette = [
        { color: [0, 0, 0] as [number, number, number], locked: true },
        { color: [255, 255, 255] as [number, number, number], locked: false },
        { color: [255, 0, 0] as [number, number, number], locked: true }
      ]
      store.set(userPaletteAtom, initialPalette)

      // Switch hardware
      store.set(setCpcHardwareAtom, 'plus')

      // All colors should be unlocked
      const updatedPalette = store.get(userPaletteAtom)
      expect(updatedPalette.every((slot) => !slot.locked)).toBe(true)
    })

    it('should persist CPC hardware selection in localStorage', () => {
      // Set hardware to PLUS
      store.set(setCpcHardwareAtom, 'plus')

      // Verify it's stored in localStorage
      const stored = localStorage.getItem('pixsaur-cpc-hardware')
      expect(stored).toBe(JSON.stringify('plus'))
    })

    it('should use atomWithStorage for persistence (integration test)', () => {
      // This test verifies the atom is configured with atomWithStorage
      // by checking the localStorage key is used when setting a value

      // Clear any existing value
      localStorage.removeItem('pixsaur-cpc-hardware')

      // Set the value
      store.set(cpcHardwareAtom, 'plus')

      // Verify localStorage was updated
      const stored = localStorage.getItem('pixsaur-cpc-hardware')
      expect(stored).toBe(JSON.stringify('plus'))

      // Verify we can read it back
      expect(store.get(cpcHardwareAtom)).toBe('plus')
    })

    it('should default to CLASSIC when localStorage is empty', () => {
      // Ensure localStorage is empty
      localStorage.removeItem('pixsaur-cpc-hardware')

      // Create a fresh store
      const freshStore = createStore()

      // Should default to CLASSIC
      expect(freshStore.get(cpcHardwareAtom)).toBe('classic')
    })
  })

  describe('Resize Configuration Atoms', () => {
    it('should initialize resize atoms with default values', () => {
      expect(store.get(resizeModeAtom)).toBe('auto')
      expect(store.get(centerImageAtom)).toBe(true)
    })

    it('should set resize mode with setResizeModeAtom', () => {
      store.set(setResizeModeAtom, 'origin')
      expect(store.get(resizeModeAtom)).toBe('origin')
    })
  })

  describe('Image Adjustment Atoms', () => {
    it('should reset image adjustments with resetImageAdjustmentsAtom', () => {
      // First modify some config
      store.set(configAtom, {
        red: 2,
        green: 1.5,
        blue: 1,
        brightness: 1.2,
        contrast: 1,
        saturation: 1,
        hue: 10,
        vibrance: 0,
        temperature: 0,
        tint: 0,
        gamma: 1.1,
        exposure: 0.5,
        highlights: 0,
        shadows: 0,
        posterization: 200,
        lastChangedKey: 'red'
      })

      // Reset adjustments
      store.set(resetImageAdjustmentsAtom)

      // Should be back to defaults
      const config = store.get(configAtom)
      expect(config).toEqual({
        red: 1,
        green: 1,
        blue: 1,
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
        vibrance: 0,
        temperature: 0,
        tint: 0,
        gamma: 1,
        exposure: 0,
        highlights: 0,
        shadows: 0,
        posterization: 256,
        lastChangedKey: null
      })
    })

    it('should clear last changed key with clearLastChangedKeyAtom', () => {
      store.set(configAtom, (prev) => ({ ...prev, lastChangedKey: 'red' }))
      store.set(clearLastChangedKeyAtom)
      expect(store.get(configAtom).lastChangedKey).toBeNull()
    })

    it('should set component with setComponentAtom', () => {
      store.set(setComponentAtom, { key: 'brightness', value: 1.5 })
      expect(store.get(configAtom).brightness).toBe(1.5)
      expect(store.get(configAtom).lastChangedKey).toBe('brightness')
    })
  })
  it('should have correct standard dimensions for mode 0', () => {
    expect(TARGET_DIMENSION_PRESETS.mode0[0]).toEqual({
      name: 'Standard',
      width: 160,
      height: 200
    })
  })

  it('should have correct overscan dimensions for mode 0', () => {
    expect(TARGET_DIMENSION_PRESETS.mode0[1]).toEqual({
      name: 'Overscan',
      width: 192,
      height: 280
    })
  })

  it('should have correct standard dimensions for mode 1', () => {
    expect(TARGET_DIMENSION_PRESETS.mode1[0]).toEqual({
      name: 'Standard',
      width: 320,
      height: 200
    })
  })

  it('should have correct overscan dimensions for mode 1', () => {
    expect(TARGET_DIMENSION_PRESETS.mode1[1]).toEqual({
      name: 'Overscan',
      width: 384,
      height: 280
    })
  })

  it('should have correct standard dimensions for mode 2', () => {
    expect(TARGET_DIMENSION_PRESETS.mode2[0]).toEqual({
      name: 'Standard',
      width: 640,
      height: 200
    })
  })

  it('should have correct overscan dimensions for mode 2', () => {
    expect(TARGET_DIMENSION_PRESETS.mode2[1]).toEqual({
      name: 'Overscan',
      width: 768,
      height: 280
    })
  })
})
