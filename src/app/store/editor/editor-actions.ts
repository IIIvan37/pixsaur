import { atom } from 'jotai'
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { rasterChangesAtom, rasterIndexBufferAtom } from '../raster/raster'
import {
  editorCursorAtom,
  editorGridVisibleAtom,
  editorHoveredPixelAtom,
  editorModeAtom,
  editorSelectedInkAtom,
  editorToolAtom,
  editorViewportAtom,
  editorZoomAtom,
  type ZoomLevel
} from './editor-config'
import {
  type EditHistoryEntry,
  editorBasePaletteAtom,
  editorDimensionsAtom,
  editorHistoryAtom,
  editorHistoryIndexAtom,
  editorIndexBufferAtom,
  editorRasterChangesAtom,
  MAX_HISTORY_SIZE,
  type PixelEdit
} from './editor-state'

// ============================================================================
// Actions de l'éditeur
// ============================================================================

/**
 * Entrer en mode édition
 * - Copie l'index buffer courant (raster ou normal)
 * - Copie la palette et les changements raster
 * - Initialise l'historique
 */
export const enterEditModeAtom = atom(null, async (get, set) => {
  // Récupérer l'index buffer actuel (raster a priorité)
  const rasterBuffer = get(rasterIndexBufferAtom)

  if (!rasterBuffer) {
    logger.warn('[Editor] No index buffer available to edit')
    return false
  }

  const { buffer, width, height, palette } = rasterBuffer

  // Copier l'index buffer pour l'édition (nouvelle instance)
  const editBuffer = new Uint8Array(buffer)

  set(editorIndexBufferAtom, editBuffer)
  set(editorDimensionsAtom, { width, height })

  // Copier la palette de base
  set(
    editorBasePaletteAtom,
    palette.map((c) => [...c] as Vector<'RGB'>)
  )

  // Copier les changements raster
  set(editorRasterChangesAtom, [...get(rasterChangesAtom)])

  // Initialiser l'historique
  set(editorHistoryAtom, [])
  set(editorHistoryIndexAtom, -1)

  // Réinitialiser les contrôles
  set(editorToolAtom, 'pencil')
  set(editorSelectedInkAtom, 0)
  set(editorCursorAtom, null)
  set(editorViewportAtom, { x: 0, y: 0 })
  set(editorZoomAtom, 4)
  set(editorGridVisibleAtom, true)

  // Activer le mode édition
  set(editorModeAtom, true)

  logger.info('[Editor] Entered edit mode', { width, height })
  return true
})

/**
 * Quitter le mode édition sans appliquer les modifications
 */
export const cancelEditModeAtom = atom(null, (_get, set) => {
  set(editorModeAtom, false)
  set(editorIndexBufferAtom, null)
  set(editorDimensionsAtom, null)
  set(editorHistoryAtom, [])
  set(editorHistoryIndexAtom, -1)
  set(editorCursorAtom, null)
  set(editorHoveredPixelAtom, null)

  logger.info('[Editor] Cancelled edit mode')
})

/**
 * Appliquer les modifications et quitter le mode édition
 * TODO: Intégrer avec rasterOptimizationResultAtom pour persister les changements
 */
export const applyEditModeAtom = atom(null, (get, set) => {
  const editBuffer = get(editorIndexBufferAtom)
  const dimensions = get(editorDimensionsAtom)

  if (!editBuffer || !dimensions) {
    logger.warn('[Editor] No changes to apply')
    return
  }

  // TODO: Mettre à jour l'index buffer principal
  // Cela nécessite de modifier rasterOptimizationResultAtom ou de créer
  // un nouvel atome pour stocker les modifications manuelles

  logger.info('[Editor] Applied changes', {
    width: dimensions.width,
    height: dimensions.height
  })

  // Quitter le mode édition
  set(editorModeAtom, false)
  set(editorIndexBufferAtom, null)
  set(editorDimensionsAtom, null)
  set(editorHistoryAtom, [])
  set(editorHistoryIndexAtom, -1)
  set(editorCursorAtom, null)
  set(editorHoveredPixelAtom, null)
})

/**
 * Peindre un pixel avec l'encre sélectionnée
 */
export const paintPixelAtom = atom(
  null,
  (get, set, { x, y }: { x: number; y: number }) => {
    const buffer = get(editorIndexBufferAtom)
    const dimensions = get(editorDimensionsAtom)
    const selectedInk = get(editorSelectedInkAtom)

    if (!buffer || !dimensions) return

    // Vérifier les limites
    if (x < 0 || x >= dimensions.width || y < 0 || y >= dimensions.height) {
      return
    }

    const { width } = dimensions
    const offset = y * width + x
    const previousInk = buffer[offset]

    // Ne rien faire si c'est la même couleur
    if (previousInk === selectedInk) return

    // Modifier le buffer
    buffer[offset] = selectedInk

    // Créer l'entrée d'historique
    const entry: EditHistoryEntry = {
      type: 'pixel',
      edits: [
        { x, y, previousInkIndex: previousInk, newInkIndex: selectedInk }
      ],
      timestamp: Date.now()
    }

    // Ajouter à l'historique
    const history = get(editorHistoryAtom)
    const index = get(editorHistoryIndexAtom)

    // Tronquer l'historique si on a fait undo puis nouvelle action
    const newHistory = [...history.slice(0, index + 1), entry]

    // Limiter la taille de l'historique
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift()
    }

    set(editorHistoryAtom, newHistory)
    set(editorHistoryIndexAtom, newHistory.length - 1)

    // Forcer le re-render en créant une nouvelle référence
    set(editorIndexBufferAtom, new Uint8Array(buffer))
  }
)

/**
 * Peindre plusieurs pixels d'un coup (pour le drag)
 */
export const paintPixelsAtom = atom(
  null,
  (get, set, pixels: Array<{ x: number; y: number }>) => {
    const buffer = get(editorIndexBufferAtom)
    const dimensions = get(editorDimensionsAtom)
    const selectedInk = get(editorSelectedInkAtom)

    if (!buffer || !dimensions || pixels.length === 0) return

    const { width, height } = dimensions
    const edits: PixelEdit[] = []

    for (const { x, y } of pixels) {
      // Vérifier les limites
      if (x < 0 || x >= width || y < 0 || y >= height) continue

      const offset = y * width + x
      const previousInk = buffer[offset]

      // Ne pas ajouter si c'est la même couleur
      if (previousInk === selectedInk) continue

      // Modifier le buffer
      buffer[offset] = selectedInk

      edits.push({
        x,
        y,
        previousInkIndex: previousInk,
        newInkIndex: selectedInk
      })
    }

    if (edits.length === 0) return

    // Créer l'entrée d'historique
    const entry: EditHistoryEntry = {
      type: 'region',
      edits,
      timestamp: Date.now()
    }

    // Ajouter à l'historique
    const history = get(editorHistoryAtom)
    const index = get(editorHistoryIndexAtom)
    const newHistory = [...history.slice(0, index + 1), entry]

    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift()
    }

    set(editorHistoryAtom, newHistory)
    set(editorHistoryIndexAtom, newHistory.length - 1)
    set(editorIndexBufferAtom, new Uint8Array(buffer))
  }
)

/**
 * Annuler la dernière modification
 */
export const undoEditAtom = atom(null, (get, set) => {
  const buffer = get(editorIndexBufferAtom)
  const history = get(editorHistoryAtom)
  const index = get(editorHistoryIndexAtom)
  const dimensions = get(editorDimensionsAtom)

  if (!buffer || !dimensions || index < 0) return

  const entry = history[index]

  // Restaurer les pixels précédents
  for (const edit of entry.edits) {
    const offset = edit.y * dimensions.width + edit.x
    buffer[offset] = edit.previousInkIndex
  }

  set(editorHistoryIndexAtom, index - 1)
  set(editorIndexBufferAtom, new Uint8Array(buffer))

  logger.debug('[Editor] Undo', { editsCount: entry.edits.length })
})

/**
 * Refaire la modification annulée
 */
export const redoEditAtom = atom(null, (get, set) => {
  const buffer = get(editorIndexBufferAtom)
  const history = get(editorHistoryAtom)
  const index = get(editorHistoryIndexAtom)
  const dimensions = get(editorDimensionsAtom)

  if (!buffer || !dimensions || index >= history.length - 1) return

  const entry = history[index + 1]

  // Réappliquer les modifications
  for (const edit of entry.edits) {
    const offset = edit.y * dimensions.width + edit.x
    buffer[offset] = edit.newInkIndex
  }

  set(editorHistoryIndexAtom, index + 1)
  set(editorIndexBufferAtom, new Uint8Array(buffer))

  logger.debug('[Editor] Redo', { editsCount: entry.edits.length })
})

/**
 * Déplacer le curseur clavier
 */
export const moveCursorAtom = atom(
  null,
  (
    get,
    set,
    direction: 'up' | 'down' | 'left' | 'right',
    largeStep = false
  ) => {
    const dimensions = get(editorDimensionsAtom)
    const cursor = get(editorCursorAtom)

    if (!dimensions) return

    const step = largeStep ? 8 : 1

    // Initialiser le curseur au centre si pas encore défini
    const currentPos = cursor ?? {
      x: Math.floor(dimensions.width / 2),
      y: Math.floor(dimensions.height / 2)
    }

    let newX = currentPos.x
    let newY = currentPos.y

    switch (direction) {
      case 'up':
        newY = Math.max(0, currentPos.y - step)
        break
      case 'down':
        newY = Math.min(dimensions.height - 1, currentPos.y + step)
        break
      case 'left':
        newX = Math.max(0, currentPos.x - step)
        break
      case 'right':
        newX = Math.min(dimensions.width - 1, currentPos.x + step)
        break
    }

    set(editorCursorAtom, { x: newX, y: newY })
  }
)

/**
 * Peindre au curseur clavier
 */
export const paintAtCursorAtom = atom(null, (get, set) => {
  const cursor = get(editorCursorAtom)
  if (!cursor) return

  set(paintPixelAtom, cursor)
})

/**
 * Pipette : sélectionner la couleur du pixel sous le curseur
 */
export const eyedropperAtom = atom(
  null,
  (get, set, { x, y }: { x: number; y: number }) => {
    const buffer = get(editorIndexBufferAtom)
    const dimensions = get(editorDimensionsAtom)

    if (!buffer || !dimensions) return

    // Vérifier les limites
    if (x < 0 || x >= dimensions.width || y < 0 || y >= dimensions.height) {
      return
    }

    const offset = y * dimensions.width + x
    const inkIndex = buffer[offset]

    set(editorSelectedInkAtom, inkIndex)
    logger.debug('[Editor] Eyedropper selected ink', { inkIndex, x, y })
  }
)

/**
 * Changer le niveau de zoom
 */
export const setZoomAtom = atom(null, (_get, set, zoom: ZoomLevel) => {
  set(editorZoomAtom, zoom)
})

/**
 * Zoom avant (niveau suivant)
 */
export const zoomInAtom = atom(null, (get, set) => {
  const currentZoom = get(editorZoomAtom)
  const levels: ZoomLevel[] = [1, 2, 4, 8, 16]
  const currentIndex = levels.indexOf(currentZoom)
  if (currentIndex < levels.length - 1) {
    set(editorZoomAtom, levels[currentIndex + 1])
  }
})

/**
 * Zoom arrière (niveau précédent)
 */
export const zoomOutAtom = atom(null, (get, set) => {
  const currentZoom = get(editorZoomAtom)
  const levels: ZoomLevel[] = [1, 2, 4, 8, 16]
  const currentIndex = levels.indexOf(currentZoom)
  if (currentIndex > 0) {
    set(editorZoomAtom, levels[currentIndex - 1])
  }
})

/**
 * Toggle affichage de la grille
 */
export const toggleGridAtom = atom(null, (get, set) => {
  set(editorGridVisibleAtom, !get(editorGridVisibleAtom))
})
