import { atom } from 'jotai'
import {
  egxEnabledAtom,
  egxTypeAtom,
  pixelModeAtom
} from '@/app/store/config/config'
import type { PixelMode } from '@/app/store/config/types'
import { logger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { getMaxColorIndex, getModeForLine } from '@/libs/pixsaur-egx'
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
  type EditHistoryEntry,
  editorBasePaletteAtom,
  editorDimensionsAtom,
  editorEgxConfigAtom,
  editorEgxEnabledAtom,
  editorHistoryAtom,
  editorHistoryIndexAtom,
  editorIndexBufferAtom,
  editorOriginalBufferAtom,
  editorPixelModeAtom,
  editorRasterChangesAtom,
  MAX_HISTORY_SIZE,
  type PixelEdit
} from './editor-state'

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
  // Use the effective buffer (with manual edits) for editing
  const indexBufferData = await get(effectiveIndexBufferAtom)

  if (!indexBufferData) {
    logger.warn('[Editor] No index buffer available to edit')
    return false
  }

  const { buffer, width, height, palette } = indexBufferData

  // Get the BASE buffer (without manual edits) for comparison when applying changes
  // This allows accumulating edits correctly
  const egxEnabled = get(egxEnabledAtom)
  const rasterEnabled = get(rasterEnabledAtom)

  let baseBuffer: Uint8Array
  if (egxEnabled) {
    const egxBuffer = await get(egxIndexBufferAtom)
    baseBuffer = egxBuffer
      ? new Uint8Array(egxBuffer.buffer)
      : new Uint8Array(buffer)
  } else if (rasterEnabled) {
    const rasterBuffer = get(rasterIndexBufferAtom)
    baseBuffer = rasterBuffer
      ? new Uint8Array(rasterBuffer.buffer)
      : new Uint8Array(buffer)
  } else {
    const previewBuffer = await get(previewIndexBufferAtom)
    baseBuffer = previewBuffer
      ? new Uint8Array(previewBuffer.buffer)
      : new Uint8Array(buffer)
  }

  // Save the BASE buffer (without edits) for comparison when applying changes
  set(editorOriginalBufferAtom, baseBuffer)

  // Copy the EFFECTIVE buffer (with existing edits) for editing
  const editBuffer = new Uint8Array(buffer)

  set(editorIndexBufferAtom, editBuffer)
  set(editorDimensionsAtom, { width, height })

  // Capturer l'état EGX (déjà récupéré plus haut)
  set(editorEgxEnabledAtom, egxEnabled)
  if (egxEnabled) {
    const egxConfig = get(egxConfigAtom)
    set(editorEgxConfigAtom, egxConfig)
  } else {
    set(editorEgxConfigAtom, null)
  }

  // Capturer le mode pixel pour l'aspect ratio
  // En EGX, utiliser le mode haute résolution pour l'aspect ratio
  if (egxEnabled) {
    const egxType = get(egxTypeAtom)
    // EGX1 uses Mode 1 dimensions (square pixels)
    // EGX2 uses Mode 2 dimensions (tall pixels)
    const egxPixelMode: PixelMode = egxType === 'egx1' ? 1 : 2
    set(editorPixelModeAtom, egxPixelMode)
  } else {
    set(editorPixelModeAtom, get(pixelModeAtom))
  }

  // Copier la palette de base
  set(
    editorBasePaletteAtom,
    palette.map((c) => [...c] as Vector<'RGB'>)
  )

  // Copier les changements raster
  const rasterChanges = get(rasterChangesAtom)
  set(editorRasterChangesAtom, [...rasterChanges])

  // Initialiser l'historique
  set(editorHistoryAtom, [])
  set(editorHistoryIndexAtom, -1)

  // Réinitialiser les contrôles
  set(editorSelectedInkAtom, 0)
  set(editorCursorAtom, null)
  set(editorViewportAtom, { x: 0, y: 0 })
  set(editorZoomAtom, 4)
  set(editorGridVisibleAtom, true)

  // Activer le mode édition
  set(editorModeAtom, true)

  logger.info('[Editor] Entered edit mode', { width, height, egxEnabled })
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
    const selectedInk = get(editorSelectedInkAtom)
    const egxEnabled = get(editorEgxEnabledAtom)
    const egxConfig = get(editorEgxConfigAtom)

    if (!buffer || !dimensions) return

    // Vérifier les limites
    if (x < 0 || x >= dimensions.width || y < 0 || y >= dimensions.height) {
      return
    }

    // Vérifier les contraintes EGX
    if (egxEnabled && egxConfig) {
      const lineMode = getModeForLine(y, egxConfig)
      const maxColorIndex = getMaxColorIndex(lineMode, egxConfig.type)
      if (selectedInk > maxColorIndex) {
        logger.warn('[Editor] EGX: ink index exceeds line limit', {
          selectedInk,
          maxColorIndex,
          line: y,
          lineMode
        })
        return
      }
    }

    const { width } = dimensions

    // Determine if this is a low-res line in EGX mode
    // Low-res lines have pixels grouped by 2
    let isLowResLine = false
    if (egxEnabled && egxConfig) {
      const lineMode = getModeForLine(y, egxConfig)
      const highResMode = egxConfig.type === 'egx1' ? 1 : 2
      isLowResLine = lineMode !== highResMode
    }

    // For low-res lines, align x to the pixel group boundary (even x)
    const alignedX = isLowResLine ? x - (x % 2) : x

    // Collect all pixels to paint (1 for high-res, 2 for low-res)
    const pixelsToPaint: Array<{ x: number; y: number; offset: number }> = []

    if (isLowResLine) {
      // Paint both pixels of the CPC pixel group
      pixelsToPaint.push({ x: alignedX, y, offset: y * width + alignedX })
      if (alignedX + 1 < width) {
        pixelsToPaint.push({
          x: alignedX + 1,
          y,
          offset: y * width + alignedX + 1
        })
      }
    } else {
      // High-res line: paint single pixel
      pixelsToPaint.push({ x, y, offset: y * width + x })
    }

    // Check if any pixel actually changes
    const edits: PixelEdit[] = []
    for (const pixel of pixelsToPaint) {
      const previousInk = buffer[pixel.offset]
      if (previousInk !== selectedInk) {
        edits.push({
          x: pixel.x,
          y: pixel.y,
          previousInkIndex: previousInk,
          newInkIndex: selectedInk
        })
        buffer[pixel.offset] = selectedInk
      }
    }

    // Ne rien faire si aucun pixel n'a changé
    if (edits.length === 0) return

    // Créer l'entrée d'historique
    const entry: EditHistoryEntry = {
      type: 'pixel',
      edits,
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
    const egxEnabled = get(editorEgxEnabledAtom)
    const egxConfig = get(editorEgxConfigAtom)

    if (!buffer || !dimensions || pixels.length === 0) return

    const { width, height } = dimensions
    const edits: PixelEdit[] = []

    for (const { x, y } of pixels) {
      // Vérifier les limites
      if (x < 0 || x >= width || y < 0 || y >= height) continue

      // Vérifier les contraintes EGX
      if (egxEnabled && egxConfig) {
        const lineMode = getModeForLine(y, egxConfig)
        const maxColorIndex = getMaxColorIndex(lineMode, egxConfig.type)
        if (selectedInk > maxColorIndex) {
          continue // Skip pixels where selected ink exceeds line limit
        }
      }

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
