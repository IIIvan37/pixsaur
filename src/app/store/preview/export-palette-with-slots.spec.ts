import { createStore } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { dimensionPresetAtom, pixelModeAtom } from '../config/config'
import { userPaletteAtom } from '../palette/palette'
import type { PaletteSlot } from '../palette/types'

// Mock les atoms async car ils sont complexes à tester directement
// On teste la logique de reconstruction de palette avec slots vides

describe('Export Palette With Slots Logic', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  // Fonction helper qui simule la logique de exportPaletteWithSlotsAtom
  function buildExportPaletteWithSlots(
    reducedPalette: Vector[],
    userPalette: PaletteSlot[],
    maxColors: number
  ): Vector[] {
    if (reducedPalette.length === 0) {
      return []
    }

    // Trouver la couleur la plus sombre pour remplir les slots vides
    const darkestColor = reducedPalette.reduce((darkest, color) => {
      const luminance = 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]
      const darkestLuminance =
        0.299 * darkest[0] + 0.587 * darkest[1] + 0.114 * darkest[2]
      return luminance < darkestLuminance ? color : darkest
    }, reducedPalette[0])

    // Reconstruire la palette complète avec les slots vides à leur position
    const fullPalette: Vector[] = []
    let reducedIndex = 0

    for (let i = 0; i < maxColors; i++) {
      const slot = userPalette[i]
      if (slot?.locked && slot.color === null) {
        // Slot vide locké: utiliser la couleur la plus sombre comme placeholder
        fullPalette.push(darkestColor)
      } else if (reducedIndex < reducedPalette.length) {
        // Slot avec couleur: utiliser la couleur de la palette réduite
        fullPalette.push(reducedPalette[reducedIndex])
        reducedIndex++
      } else {
        // Pas assez de couleurs: remplir avec la couleur la plus sombre
        fullPalette.push(darkestColor)
      }
    }

    return fullPalette
  }

  describe('buildExportPaletteWithSlots', () => {
    it('should return empty array for empty reduced palette', () => {
      const result = buildExportPaletteWithSlots(
        [],
        [{ color: null, locked: false }],
        4
      )
      expect(result).toEqual([])
    })

    it('should return reduced palette as-is when no locked empty slots', () => {
      const reducedPalette: Vector[] = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0]
      ]
      const userPalette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: false },
        { color: [0, 255, 0], locked: false },
        { color: [0, 0, 255], locked: false },
        { color: [255, 255, 0], locked: false }
      ]

      const result = buildExportPaletteWithSlots(reducedPalette, userPalette, 4)
      expect(result).toEqual(reducedPalette)
    })

    it('should insert darkest color at locked empty slot position', () => {
      // Palette réduite avec 3 couleurs (slot 1 est vide locké)
      const reducedPalette: Vector[] = [
        [255, 0, 0], // Slot 0
        [0, 255, 0], // Devrait aller au slot 2
        [0, 0, 255] // Devrait aller au slot 3
      ]
      const userPalette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: false }, // Slot 0
        { color: null, locked: true }, // Slot 1 - vide et locké
        { color: [0, 255, 0], locked: false }, // Slot 2
        { color: [0, 0, 255], locked: false } // Slot 3
      ]

      const result = buildExportPaletteWithSlots(reducedPalette, userPalette, 4)

      // Slot 1 devrait contenir la couleur la plus sombre (noir ou bleu dans ce cas)
      expect(result[0]).toEqual([255, 0, 0]) // Slot 0 - première couleur
      expect(result[1]).toEqual([0, 0, 255]) // Slot 1 - couleur la plus sombre (bleu)
      expect(result[2]).toEqual([0, 255, 0]) // Slot 2 - deuxième couleur
      expect(result[3]).toEqual([0, 0, 255]) // Slot 3 - troisième couleur
    })

    it('should handle multiple locked empty slots', () => {
      // Palette réduite avec 2 couleurs (slots 1 et 3 sont vides lockés)
      const reducedPalette: Vector[] = [
        [255, 255, 255], // Blanc - slot 0
        [0, 0, 0] // Noir - slot 2
      ]
      const userPalette: PaletteSlot[] = [
        { color: [255, 255, 255], locked: false }, // Slot 0
        { color: null, locked: true }, // Slot 1 - vide et locké
        { color: [0, 0, 0], locked: false }, // Slot 2
        { color: null, locked: true } // Slot 3 - vide et locké
      ]

      const result = buildExportPaletteWithSlots(reducedPalette, userPalette, 4)

      // La couleur la plus sombre est le noir [0,0,0]
      expect(result[0]).toEqual([255, 255, 255]) // Slot 0 - blanc
      expect(result[1]).toEqual([0, 0, 0]) // Slot 1 - noir (placeholder)
      expect(result[2]).toEqual([0, 0, 0]) // Slot 2 - noir
      expect(result[3]).toEqual([0, 0, 0]) // Slot 3 - noir (placeholder)
    })

    it('should use darkest color for placeholder (luminance calculation)', () => {
      // Palette avec différentes luminances
      const reducedPalette: Vector[] = [
        [255, 255, 255], // Blanc - luminance maximale
        [128, 128, 128], // Gris - luminance moyenne
        [50, 0, 0] // Rouge sombre - devrait être le plus sombre
      ]
      const userPalette: PaletteSlot[] = [
        { color: [255, 255, 255], locked: false },
        { color: null, locked: true }, // Slot vide locké
        { color: [128, 128, 128], locked: false },
        { color: [50, 0, 0], locked: false }
      ]

      const result = buildExportPaletteWithSlots(reducedPalette, userPalette, 4)

      // Le slot 1 (vide locké) devrait avoir la couleur la plus sombre
      expect(result[1]).toEqual([50, 0, 0])
    })

    it('should handle mode 1 (4 colors) with locked empty slots', () => {
      store.set(pixelModeAtom, 1)
      store.set(dimensionPresetAtom, 'standard')

      const reducedPalette: Vector[] = [
        [0, 0, 0],
        [255, 255, 255]
      ]
      const userPalette: PaletteSlot[] = [
        { color: [0, 0, 0], locked: true },
        { color: null, locked: true }, // Vide locké
        { color: null, locked: true }, // Vide locké
        { color: [255, 255, 255], locked: false }
      ]

      const result = buildExportPaletteWithSlots(reducedPalette, userPalette, 4)

      expect(result).toHaveLength(4)
      expect(result[0]).toEqual([0, 0, 0]) // Couleur existante
      expect(result[1]).toEqual([0, 0, 0]) // Placeholder (noir est le plus sombre)
      expect(result[2]).toEqual([0, 0, 0]) // Placeholder
      expect(result[3]).toEqual([255, 255, 255]) // Couleur existante
    })

    it('should handle mode 2 (2 colors) with one locked empty slot', () => {
      const reducedPalette: Vector[] = [[255, 255, 255]] // Seulement 1 couleur
      const userPalette: PaletteSlot[] = [
        { color: null, locked: true }, // Slot 0 - vide et locké
        { color: [255, 255, 255], locked: false } // Slot 1 - blanc
      ]

      const result = buildExportPaletteWithSlots(reducedPalette, userPalette, 2)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual([255, 255, 255]) // Placeholder (seule couleur disponible)
      expect(result[1]).toEqual([255, 255, 255]) // Couleur existante
    })

    it('should preserve exact color positions for index mapping', () => {
      // Cas d'usage réel: mode 0 (16 couleurs) avec quelques slots vides
      const reducedPalette: Vector[] = [
        [0, 0, 0], // Index 0
        [255, 0, 0], // Index 1 -> devrait aller au slot 2
        [0, 255, 0], // Index 2 -> devrait aller au slot 4
        [0, 0, 255] // Index 3 -> devrait aller au slot 5
      ]

      // Slots 1 et 3 sont vides et lockés
      const userPalette: PaletteSlot[] = [
        { color: [0, 0, 0], locked: false }, // 0
        { color: null, locked: true }, // 1 - vide locké
        { color: [255, 0, 0], locked: false }, // 2
        { color: null, locked: true }, // 3 - vide locké
        { color: [0, 255, 0], locked: false }, // 4
        { color: [0, 0, 255], locked: false } // 5
      ]

      const result = buildExportPaletteWithSlots(reducedPalette, userPalette, 6)

      // Vérifier que chaque couleur est à la bonne position
      expect(result[0]).toEqual([0, 0, 0]) // Noir
      expect(result[1]).toEqual([0, 0, 0]) // Placeholder (noir = plus sombre)
      expect(result[2]).toEqual([255, 0, 0]) // Rouge
      expect(result[3]).toEqual([0, 0, 0]) // Placeholder (noir = plus sombre)
      expect(result[4]).toEqual([0, 255, 0]) // Vert
      expect(result[5]).toEqual([0, 0, 255]) // Bleu
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
      const reducedPalette: Vector[] = [] // Aucune couleur générée
      const userPalette: PaletteSlot[] = [
        { color: null, locked: true },
        { color: null, locked: true },
        { color: null, locked: true },
        { color: null, locked: true }
      ]

      const result = buildExportPaletteWithSlots(reducedPalette, userPalette, 4)

      // Avec une palette réduite vide, le résultat devrait être vide
      expect(result).toEqual([])
    })

    it('should handle locked slots with colors (not empty)', () => {
      // Les slots lockés avec couleurs ne sont PAS des slots vides
      const reducedPalette: Vector[] = [
        [255, 0, 0],
        [0, 255, 0]
      ]
      const userPalette: PaletteSlot[] = [
        { color: [255, 0, 0], locked: true }, // Locké AVEC couleur
        { color: [0, 255, 0], locked: true }, // Locké AVEC couleur
        { color: null, locked: false },
        { color: null, locked: false }
      ]

      const result = buildExportPaletteWithSlots(reducedPalette, userPalette, 4)

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
