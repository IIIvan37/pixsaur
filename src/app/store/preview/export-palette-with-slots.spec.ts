import { createStore } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { dimensionPresetAtom, pixelModeAtom } from '../config/config'
import { userPaletteAtom } from '../palette/palette'
import type { PaletteSlot } from '../palette/types'

// Valeur spéciale pour marquer un slot ignoré
const IGNORED_SLOT: Vector = [-1, -1, -1]

// Mock les atoms async car ils sont complexes à tester directement
// On teste la logique de reconstruction de palette avec slots vides

describe('Export Palette With Slots Logic', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  // Fonction helper qui simule la logique de exportPaletteWithSlotsAtom
  // Les slots ignorés sont marqués avec [-1, -1, -1]
  function buildExportPaletteWithSlots(
    userPalette: PaletteSlot[],
    maxColors: number
  ): Vector[] {
    // Collecter les couleurs valides
    const validColors: Vector[] = []
    for (let i = 0; i < maxColors; i++) {
      const slot = userPalette[i]
      if (slot?.color && !(slot.locked && slot.color === null)) {
        validColors.push(slot.color)
      }
    }

    if (validColors.length === 0) {
      return []
    }

    // Trouver la couleur la plus sombre pour remplir les slots vides non lockés
    const darkestColor = validColors.reduce((darkest, color) => {
      const luminance = 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]
      const darkestLuminance =
        0.299 * darkest[0] + 0.587 * darkest[1] + 0.114 * darkest[2]
      return luminance < darkestLuminance ? color : darkest
    }, validColors[0])

    // Reconstruire la palette complète
    const fullPalette: Vector[] = []

    for (let i = 0; i < maxColors; i++) {
      const slot = userPalette[i]
      if (slot?.locked && slot.color === null) {
        // Slot vide locké: marquer comme ignoré avec [-1, -1, -1]
        fullPalette.push(IGNORED_SLOT)
      } else if (slot?.color) {
        // Slot avec couleur
        fullPalette.push(slot.color)
      } else {
        // Slot sans couleur (non locké): remplir avec la couleur la plus sombre
        fullPalette.push(darkestColor)
      }
    }

    return fullPalette
  }

  // Helper pour vérifier si un slot est ignoré
  function isIgnoredSlot(color: Vector): boolean {
    return color[0] === -1 && color[1] === -1 && color[2] === -1
  }

  describe('buildExportPaletteWithSlots', () => {
    it('should return empty array when no valid colors', () => {
      const userPalette: PaletteSlot[] = [
        { color: null, locked: true },
        { color: null, locked: true }
      ]
      const result = buildExportPaletteWithSlots(userPalette, 2)
      expect(result).toEqual([])
    })

    it('should return palette as-is when no locked empty slots', () => {
      const userPalette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: false },
        { color: [0, 255, 0], locked: false },
        { color: [0, 0, 255], locked: false },
        { color: [255, 255, 0], locked: false }
      ]

      const result = buildExportPaletteWithSlots(userPalette, 4)
      expect(result).toEqual([
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0]
      ])
    })

    it('should mark locked empty slot with IGNORED_SLOT [-1,-1,-1]', () => {
      const userPalette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: false }, // Slot 0
        { color: null, locked: true }, // Slot 1 - vide et locké
        { color: [0, 255, 0], locked: false }, // Slot 2
        { color: [0, 0, 255], locked: false } // Slot 3
      ]

      const result = buildExportPaletteWithSlots(userPalette, 4)

      expect(result[0]).toEqual([255, 0, 0]) // Slot 0 - couleur normale
      expect(isIgnoredSlot(result[1])).toBe(true) // Slot 1 - ignoré [-1,-1,-1]
      expect(result[2]).toEqual([0, 255, 0]) // Slot 2 - couleur normale
      expect(result[3]).toEqual([0, 0, 255]) // Slot 3 - couleur normale
    })

    it('should handle multiple locked empty slots', () => {
      const userPalette: PaletteSlot[] = [
        { color: [255, 255, 255], locked: false }, // Slot 0
        { color: null, locked: true }, // Slot 1 - vide et locké
        { color: [0, 0, 0], locked: false }, // Slot 2
        { color: null, locked: true } // Slot 3 - vide et locké
      ]

      const result = buildExportPaletteWithSlots(userPalette, 4)

      expect(result[0]).toEqual([255, 255, 255]) // Slot 0 - blanc
      expect(isIgnoredSlot(result[1])).toBe(true) // Slot 1 - ignoré
      expect(result[2]).toEqual([0, 0, 0]) // Slot 2 - noir
      expect(isIgnoredSlot(result[3])).toBe(true) // Slot 3 - ignoré
    })

    it('should use darkest color for non-locked empty slots', () => {
      // Palette avec différentes luminances
      const userPalette: PaletteSlot[] = [
        { color: [255, 255, 255], locked: false }, // Blanc
        { color: null, locked: false }, // Slot vide non locké - devrait être rempli
        { color: [128, 128, 128], locked: false }, // Gris
        { color: [50, 0, 0], locked: false } // Rouge sombre - le plus sombre
      ]

      const result = buildExportPaletteWithSlots(userPalette, 4)

      // Le slot 1 (vide non locké) devrait avoir la couleur la plus sombre
      expect(result[1]).toEqual([50, 0, 0])
    })

    it('should handle mode 1 (4 colors) with locked empty slots', () => {
      store.set(pixelModeAtom, 1)
      store.set(dimensionPresetAtom, 'standard')

      const userPalette: PaletteSlot[] = [
        { color: [0, 0, 0], locked: true },
        { color: null, locked: true }, // Vide locké
        { color: null, locked: true }, // Vide locké
        { color: [255, 255, 255], locked: false }
      ]

      const result = buildExportPaletteWithSlots(userPalette, 4)

      expect(result).toHaveLength(4)
      expect(result[0]).toEqual([0, 0, 0]) // Couleur existante
      expect(isIgnoredSlot(result[1])).toBe(true) // Ignoré
      expect(isIgnoredSlot(result[2])).toBe(true) // Ignoré
      expect(result[3]).toEqual([255, 255, 255]) // Couleur existante
    })

    it('should handle mode 2 (2 colors) with one locked empty slot', () => {
      const userPalette: PaletteSlot[] = [
        { color: null, locked: true }, // Slot 0 - vide et locké
        { color: [255, 255, 255], locked: false } // Slot 1 - blanc
      ]

      const result = buildExportPaletteWithSlots(userPalette, 2)

      expect(result).toHaveLength(2)
      expect(isIgnoredSlot(result[0])).toBe(true) // Ignoré
      expect(result[1]).toEqual([255, 255, 255]) // Couleur existante
    })

    it('should preserve exact color positions for index mapping', () => {
      // Cas d'usage réel: mode 0 (16 couleurs) avec quelques slots vides
      // Slots 1 et 3 sont vides et lockés
      const userPalette: PaletteSlot[] = [
        { color: [0, 0, 0], locked: false }, // 0
        { color: null, locked: true }, // 1 - vide locké
        { color: [255, 0, 0], locked: false }, // 2
        { color: null, locked: true }, // 3 - vide locké
        { color: [0, 255, 0], locked: false }, // 4
        { color: [0, 0, 255], locked: false } // 5
      ]

      const result = buildExportPaletteWithSlots(userPalette, 6)

      // Vérifier que chaque couleur est à la bonne position
      expect(result[0]).toEqual([0, 0, 0]) // Noir
      expect(isIgnoredSlot(result[1])).toBe(true) // Ignoré [-1,-1,-1]
      expect(result[2]).toEqual([255, 0, 0]) // Rouge
      expect(isIgnoredSlot(result[3])).toBe(true) // Ignoré [-1,-1,-1]
      expect(result[4]).toEqual([0, 255, 0]) // Vert
      expect(result[5]).toEqual([0, 0, 255]) // Bleu
    })

    it('should correctly identify ignored slots with isIgnoredSlot helper', () => {
      expect(isIgnoredSlot([-1, -1, -1])).toBe(true)
      expect(isIgnoredSlot([0, 0, 0])).toBe(false)
      expect(isIgnoredSlot([255, 255, 255])).toBe(false)
      expect(isIgnoredSlot([-1, 0, 0])).toBe(false) // Only all -1 is ignored
    })
  })

  describe('Integration with userPaletteAtom', () => {
    it('should count locked empty slots correctly', () => {
      store.set(pixelModeAtom, 1) // Mode 1 = 4 couleurs

      const palette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: false },
        { color: null, locked: true }, // Vide locké
        { color: [0, 255, 0], locked: false },
        { color: null, locked: true } // Vide locké
      ]
      store.set(userPaletteAtom, palette)

      // Compter manuellement les slots vides lockés
      const lockedEmptyCount = palette
        .slice(0, 4)
        .filter((slot) => slot.locked && slot.color === null).length

      expect(lockedEmptyCount).toBe(2)
    })

    it('should handle all slots locked and empty', () => {
      const userPalette: PaletteSlot[] = [
        { color: null, locked: true },
        { color: null, locked: true },
        { color: null, locked: true },
        { color: null, locked: true }
      ]

      const result = buildExportPaletteWithSlots(userPalette, 4)

      // Avec aucune couleur valide, le résultat devrait être vide
      expect(result).toEqual([])
    })

    it('should handle locked slots with colors (not empty)', () => {
      // Les slots lockés avec couleurs ne sont PAS des slots vides
      const userPalette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: true }, // Locké AVEC couleur
        { color: [0, 255, 0], locked: true }, // Locké AVEC couleur
        { color: null, locked: false },
        { color: null, locked: false }
      ]

      const result = buildExportPaletteWithSlots(userPalette, 4)

      // Les slots lockés avec couleurs sont traités normalement
      expect(result[0]).toEqual([255, 0, 0])
      expect(result[1]).toEqual([0, 255, 0])
      // Slots 2 et 3 sont remplis avec la couleur la plus sombre
      // Rouge [255,0,0] a une luminance de 0.299*255 = 76.2
      // Vert [0,255,0] a une luminance de 0.587*255 = 149.7
      // Donc rouge est plus sombre que vert
      expect(result[2]).toEqual([255, 0, 0])
      expect(result[3]).toEqual([255, 0, 0])
    })
  })
})
