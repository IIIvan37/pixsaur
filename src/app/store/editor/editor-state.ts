import { atom } from 'jotai'
import type { PixelMode } from '@/app/store/config/types'
// Domain types now live in the application layer; imported for local use and
// re-exported below for the store's many consumers (preview pipeline, barrels).
import {
  type EditHistoryEntry,
  MAX_HISTORY_SIZE,
  type PixelEdit
} from '@/editor/application/types'
import { getAspectRatioMultipliers } from '@/export/cpc-calculations'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig } from '@/libs/pixsaur-egx'
import { getMaxColorIndex, getModeForLine } from '@/libs/pixsaur-egx'
import type { RasterChange } from '@/libs/pixsaur-raster/types'

export { type EditHistoryEntry, MAX_HISTORY_SIZE, type PixelEdit }

// ============================================================================
// État de l'éditeur de preview
// ============================================================================

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
 * Whether EGX mode is active in the editor
 */
export const editorEgxEnabledAtom = atom<boolean>(false)

/**
 * EGX configuration captured when entering edit mode
 * Used to determine color constraints per line
 */
export const editorEgxConfigAtom = atom<EGXConfig | null>(null)

/**
 * Get the CPC pixel grouping factor for a line.
 * In EGX mode, low-res lines (Mode 0 for EGX1, Mode 1 for EGX2) have pixels
 * that are 2x wider than high-res lines.
 * Returns 2 for low-res lines, 1 for high-res lines.
 */
export const getLineCpcPixelWidthAtom = atom((get) => {
  const egxEnabled = get(editorEgxEnabledAtom)
  const egxConfig = get(editorEgxConfigAtom)

  return (line: number): number => {
    if (!egxEnabled || !egxConfig) {
      return 1 // No grouping in standard mode
    }

    const lineMode = getModeForLine(line, egxConfig)
    // In EGX, the buffer is at high-res resolution
    // Low-res lines have pixels that span 2 buffer pixels
    // EGX1: Mode 0 (low-res) vs Mode 1 (high-res) - Mode 0 pixels are 2x wider
    // EGX2: Mode 1 (low-res) vs Mode 2 (high-res) - Mode 1 pixels are 2x wider
    const highResMode = egxConfig.type === 'egx1' ? 1 : 2
    return lineMode === highResMode ? 1 : 2
  }
})

/**
 * Historique des modifications
 */
export const editorHistoryAtom = atom<EditHistoryEntry[]>([])

/**
 * Index courant dans l'historique (-1 = aucune modification)
 */
export const editorHistoryIndexAtom = atom<number>(-1)

// ============================================================================
// Atomes dérivés
// ============================================================================

/**
 * Fonction pour obtenir la palette effective d'une ligne
 * - Pour le mode standard: retourne la palette complète
 * - Pour le mode raster: applique les changements raster jusqu'à cette ligne
 * - Pour le mode EGX: retourne la sous-palette disponible selon le mode de la ligne
 */
export const getLinePaletteAtom = atom((get) => {
  const basePalette = get(editorBasePaletteAtom)
  const rasterChanges = get(editorRasterChangesAtom)
  const egxEnabled = get(editorEgxEnabledAtom)
  const egxConfig = get(editorEgxConfigAtom)

  return (line: number): Vector<'RGB'>[] => {
    // Copie de la palette de base
    const effectivePalette = basePalette.map((c) => [...c] as Vector<'RGB'>)

    // Appliquer tous les changements raster jusqu'à cette ligne (incluse)
    for (const change of rasterChanges) {
      if (change.line <= line) {
        effectivePalette[change.inkIndex] = [...change.color] as Vector<'RGB'>
      }
    }

    // Pour EGX, limiter la palette selon le mode de la ligne
    if (egxEnabled && egxConfig) {
      const lineMode = getModeForLine(line, egxConfig)
      const maxColorIndex = getMaxColorIndex(lineMode, egxConfig.type)
      // Return only the colors available for this line
      return effectivePalette.slice(0, maxColorIndex + 1)
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
