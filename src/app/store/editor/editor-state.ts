import { atom } from 'jotai'
import type { PixelMode } from '@/app/store/config/types'
import { getAspectRatioMultipliers } from '@/export/cpc-calculations'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterChange } from '@/libs/pixsaur-raster/types'

// ============================================================================
// État de l'éditeur de preview
// ============================================================================

/**
 * Modification d'un pixel individuel
 */
export interface PixelEdit {
  x: number
  y: number
  previousInkIndex: number
  newInkIndex: number
}

/**
 * Entrée dans l'historique des modifications
 */
export interface EditHistoryEntry {
  type: 'pixel' | 'region' | 'fill'
  edits: PixelEdit[]
  timestamp: number
}

/**
 * Copie de travail de l'index buffer pendant l'édition
 * Initialisé depuis rasterIndexBufferAtom ou previewIndexBufferAtom
 */
export const editorIndexBufferAtom = atom<Uint8Array | null>(null)

/**
 * Dimensions de l'image en cours d'édition
 */
export const editorDimensionsAtom = atom<{
  width: number
  height: number
} | null>(null)

/**
 * Buffer original avant édition (pour comparaison lors de l'application)
 */
export const editorOriginalBufferAtom = atom<Uint8Array | null>(null)

/**
 * Mode pixel actuel (0, 1, 2) pour calculer l'aspect ratio
 */
export const editorPixelModeAtom = atom<PixelMode>(1)

/**
 * Aspect ratio des pixels basé sur le mode
 * Mode 0: pixels 2x plus larges (widthMultiplier = 2)
 * Mode 1: pixels carrés (1:1)
 * Mode 2: pixels 2x plus hauts (heightMultiplier = 2)
 */
export const editorPixelAspectAtom = atom((get) => {
  const mode = get(editorPixelModeAtom)
  return getAspectRatioMultipliers(mode)
})

/**
 * Palette de base (avant application des rasters)
 */
export const editorBasePaletteAtom = atom<Vector<'RGB'>[]>([])

/**
 * Changements raster actifs pendant l'édition
 * Permet de calculer la palette effective par ligne
 */
export const editorRasterChangesAtom = atom<RasterChange[]>([])

/**
 * Historique des modifications
 */
export const editorHistoryAtom = atom<EditHistoryEntry[]>([])

/**
 * Index courant dans l'historique (-1 = aucune modification)
 */
export const editorHistoryIndexAtom = atom<number>(-1)

/**
 * Taille maximale de l'historique
 */
export const MAX_HISTORY_SIZE = 100

// ============================================================================
// Atomes dérivés
// ============================================================================

/**
 * Fonction pour obtenir la palette effective d'une ligne
 * Applique les changements raster jusqu'à cette ligne
 */
export const getLinePaletteAtom = atom((get) => {
  const basePalette = get(editorBasePaletteAtom)
  const rasterChanges = get(editorRasterChangesAtom)

  return (line: number): Vector<'RGB'>[] => {
    // Copie de la palette de base
    const effectivePalette = basePalette.map((c) => [...c] as Vector<'RGB'>)

    // Appliquer tous les changements raster jusqu'à cette ligne (incluse)
    for (const change of rasterChanges) {
      if (change.line <= line) {
        effectivePalette[change.inkIndex] = [...change.color] as Vector<'RGB'>
      }
    }

    return effectivePalette
  }
})

/**
 * Peut-on annuler une modification ?
 */
export const canUndoAtom = atom((get) => {
  const index = get(editorHistoryIndexAtom)
  return index >= 0
})

/**
 * Peut-on refaire une modification annulée ?
 */
export const canRedoAtom = atom((get) => {
  const history = get(editorHistoryAtom)
  const index = get(editorHistoryIndexAtom)
  return index < history.length - 1
})

/**
 * Nombre de modifications dans l'historique
 */
export const historyCountAtom = atom((get) => {
  const index = get(editorHistoryIndexAtom)
  return index + 1
})

/**
 * L'image a-t-elle été modifiée ?
 */
export const hasUnsavedChangesAtom = atom((get) => {
  const index = get(editorHistoryIndexAtom)
  return index >= 0
})
