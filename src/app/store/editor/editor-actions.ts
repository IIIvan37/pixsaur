import { atom } from 'jotai'
import {
  egxEnabledAtom,
  egxTypeAtom,
  pixelModeAtom
} from '@/app/store/config/config'
import { logger } from '@/core'
import { enterEditMode } from '@/editor/application/enter-edit-mode'
import { paintPixels } from '@/editor/application/paint-pixels'
import type { Clock } from '@/editor/application/ports'
import { egxConfigAtom, egxIndexBufferAtom } from '../preview/egx-preview'
import {
  applyManualEditsAtom,
  previewIndexBufferAtom
} from '../preview/preview'
import {
  effectiveIndexBufferAtom,
  rasterChangesAtom,
  rasterEnabledAtom,
  rasterIndexBufferAtom
} from '../raster/raster'
import {
  editorCursorAtom,
  editorGridVisibleAtom,
  editorHoveredPixelAtom,
  editorModeAtom,
  editorSelectedInkAtom,
  editorViewportAtom,
  editorZoomAtom,
  type ZoomLevel
} from './editor-config'
import {
  editorBasePaletteAtom,
  editorDimensionsAtom,
  editorEgxConfigAtom,
  editorEgxEnabledAtom,
  editorHistoryAtom,
  editorHistoryIndexAtom,
  editorIndexBufferAtom,
  editorOriginalBufferAtom,
  editorPixelModeAtom,
  editorRasterChangesAtom
} from './editor-state'

/** Runtime adapter for the editor's `Clock` port. */
const systemClock: Clock = { now: () => Date.now() }

// ============================================================================
// Actions de l'éditeur
// ============================================================================

/**
 * Entrer en mode édition
 * - Copie l'index buffer courant (avec modifications manuelles si présentes)
 * - Copie la palette et les changements raster
 * - Capture l'état EGX si actif
 * - Initialise l'historique
 */
export const enterEditModeAtom = atom(null, async (get, set) => {
  // Use the effective buffer (with manual edits) for editing.
  const effective = await get(effectiveIndexBufferAtom)

  if (!effective) {
    logger.warn('[Editor] No index buffer available to edit')
    return false
  }

  const egxEnabled = get(egxEnabledAtom)
  const rasterEnabled = get(rasterEnabledAtom)

  // Resolve the mode-specific RAW base buffer (without manual edits), awaiting
  // only the active mode's source. The use-case applies the fallback to the
  // effective buffer when this is null.
  let baseBufferRaw: Uint8Array | null
  if (egxEnabled) {
    const egxBuffer = await get(egxIndexBufferAtom)
    baseBufferRaw = egxBuffer ? new Uint8Array(egxBuffer.buffer) : null
  } else if (rasterEnabled) {
    const rasterBuffer = get(rasterIndexBufferAtom)
    baseBufferRaw = rasterBuffer ? new Uint8Array(rasterBuffer.buffer) : null
  } else {
    const previewBuffer = await get(previewIndexBufferAtom)
    baseBufferRaw = previewBuffer ? new Uint8Array(previewBuffer.buffer) : null
  }

  const session = enterEditMode({
    effective,
    baseBufferRaw,
    egxEnabled,
    egxConfig: get(egxConfigAtom),
    egxType: get(egxTypeAtom),
    configPixelMode: get(pixelModeAtom),
    rasterChanges: get(rasterChangesAtom)
  })

  // Map the computed session onto the editor atoms.
  set(editorOriginalBufferAtom, session.originalBuffer)
  set(editorIndexBufferAtom, session.editBuffer)
  set(editorDimensionsAtom, session.dimensions)
  set(editorEgxEnabledAtom, session.egxEnabled)
  set(editorEgxConfigAtom, session.egxConfig)
  set(editorPixelModeAtom, session.pixelMode)
  set(editorBasePaletteAtom, session.basePalette)
  set(editorRasterChangesAtom, session.rasterChanges)

  // Constant resets (no business logic): fresh history + view controls.
  set(editorHistoryAtom, [])
  set(editorHistoryIndexAtom, -1)
  set(editorSelectedInkAtom, 0)
  set(editorCursorAtom, null)
  set(editorViewportAtom, { x: 0, y: 0 })
  set(editorZoomAtom, 4)
  set(editorGridVisibleAtom, true)

  // Activer le mode édition
  set(editorModeAtom, true)

  logger.info('[Editor] Entered edit mode', {
    width: session.dimensions.width,
    height: session.dimensions.height,
    egxEnabled: session.egxEnabled
  })
  return true
})

/**
 * Quitter le mode édition sans appliquer les modifications
 */
export const cancelEditModeAtom = atom(null, (_get, set) => {
  set(editorModeAtom, false)
  set(editorIndexBufferAtom, null)
  set(editorOriginalBufferAtom, null)
  set(editorDimensionsAtom, null)
  set(editorHistoryAtom, [])
  set(editorHistoryIndexAtom, -1)
  set(editorCursorAtom, null)
  set(editorHoveredPixelAtom, null)
  set(editorEgxEnabledAtom, false)
  set(editorEgxConfigAtom, null)

  logger.info('[Editor] Cancelled edit mode')
})

/**
 * Appliquer les modifications et quitter le mode édition
 */
export const applyEditModeAtom = atom(null, (get, set) => {
  const editBuffer = get(editorIndexBufferAtom)
  const originalBuffer = get(editorOriginalBufferAtom)
  const dimensions = get(editorDimensionsAtom)

  if (!editBuffer || !originalBuffer || !dimensions) {
    logger.warn('[Editor] No changes to apply')
    return
  }

  // Appliquer les modifications manuelles au buffer de preview
  set(
    applyManualEditsAtom,
    editBuffer,
    originalBuffer,
    dimensions.width,
    dimensions.height
  )

  logger.info('[Editor] Applied changes', {
    width: dimensions.width,
    height: dimensions.height
  })

  // Quitter le mode édition
  set(editorModeAtom, false)
  set(editorIndexBufferAtom, null)
  set(editorOriginalBufferAtom, null)
  set(editorDimensionsAtom, null)
  set(editorHistoryAtom, [])
  set(editorHistoryIndexAtom, -1)
  set(editorCursorAtom, null)
  set(editorHoveredPixelAtom, null)
  set(editorEgxEnabledAtom, false)
  set(editorEgxConfigAtom, null)
})

/**
 * Peindre un pixel avec l'encre sélectionnée
 * En mode EGX sur les lignes low-res, peint les 2 pixels du groupe CPC
 */
export const paintPixelAtom = atom(
  null,
  (get, set, { x, y }: { x: number; y: number }) => {
    const buffer = get(editorIndexBufferAtom)
    const dimensions = get(editorDimensionsAtom)
    if (!buffer || !dimensions) return

    const egxEnabled = get(editorEgxEnabledAtom)
    const result = paintPixels(
      {
        buffer,
        width: dimensions.width,
        height: dimensions.height,
        selectedInk: get(editorSelectedInkAtom),
        egxConfig: egxEnabled ? get(editorEgxConfigAtom) : null,
        pixels: [{ x, y }],
        entryType: 'pixel',
        // Single click: expand to the CPC pixel group on EGX low-res lines.
        expandLowResGroups: true,
        history: get(editorHistoryAtom),
        historyIndex: get(editorHistoryIndexAtom)
      },
      { clock: systemClock }
    )

    if (!result.changed) return

    set(editorHistoryAtom, result.history)
    set(editorHistoryIndexAtom, result.historyIndex)
    set(editorIndexBufferAtom, result.buffer)
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
    if (!buffer || !dimensions || pixels.length === 0) return

    const egxEnabled = get(editorEgxEnabledAtom)
    const result = paintPixels(
      {
        buffer,
        width: dimensions.width,
        height: dimensions.height,
        selectedInk: get(editorSelectedInkAtom),
        egxConfig: egxEnabled ? get(editorEgxConfigAtom) : null,
        pixels,
        entryType: 'region',
        // Drag stroke: paint raw pixels, no group expansion.
        expandLowResGroups: false,
        history: get(editorHistoryAtom),
        historyIndex: get(editorHistoryIndexAtom)
      },
      { clock: systemClock }
    )

    if (!result.changed) return

    set(editorHistoryAtom, result.history)
    set(editorHistoryIndexAtom, result.historyIndex)
    set(editorIndexBufferAtom, result.buffer)
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
    const hoveredPixel = get(editorHoveredPixelAtom)

    if (!dimensions) return

    const step = largeStep ? 8 : 1

    // Initialiser le curseur : position actuelle, sinon hovered, sinon centre
    const currentPos = cursor ??
      hoveredPixel ?? {
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

/**
 * Nombre d'encres disponibles (basé sur le mode CPC)
 * Mode 0: 16 encres, Mode 1: 4 encres, Mode 2: 2 encres
 */
export const inkCountAtom = atom((get) => {
  const basePalette = get(editorBasePaletteAtom)
  return basePalette.length || 16
})

/**
 * Sélectionner l'encre suivante
 */
export const nextInkAtom = atom(null, (get, set) => {
  const currentInk = get(editorSelectedInkAtom)
  const inkCount = get(inkCountAtom)
  const nextInk = (currentInk + 1) % inkCount
  set(editorSelectedInkAtom, nextInk)
})

/**
 * Sélectionner l'encre précédente
 */
export const prevInkAtom = atom(null, (get, set) => {
  const currentInk = get(editorSelectedInkAtom)
  const inkCount = get(inkCountAtom)
  const prevInk = (currentInk - 1 + inkCount) % inkCount
  set(editorSelectedInkAtom, prevInk)
})

/**
 * Sélectionner une encre par son numéro (0-15)
 */
export const selectInkAtom = atom(null, (get, set, inkIndex: number) => {
  const inkCount = get(inkCountAtom)
  if (inkIndex >= 0 && inkIndex < inkCount) {
    set(editorSelectedInkAtom, inkIndex)
  }
})
