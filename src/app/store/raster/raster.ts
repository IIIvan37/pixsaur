import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { createRasterPreviewImageData } from '@/libs/pixsaur-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { cpcHardwareAtom, effectiveModeConfigAtom } from '../config/config'
import { previewImageAtom, previewIndexBufferAtom } from '../preview/preview'

/** Max raster changes per line: 1 for most modes, 4 for Plus Mode 1 only */
export const MAX_CHANGES_PER_LINE_DEFAULT = 1
export const MAX_CHANGES_PER_LINE_PLUS_MODE1 = 4

/**
 * Whether raster mode is enabled
 */
export const rasterEnabledAtom = atomWithStorage<boolean>(
  'pixsaur-raster-enabled',
  false
)

/**
 * User-defined raster changes (single line changes, no ranges)
 */
export const rasterChangesAtom = atomWithStorage<RasterChange[]>(
  'pixsaur-raster-changes',
  []
)

/**
 * @deprecated Use rasterChangesAtom instead
 */
export const rasterRangesAtom = rasterChangesAtom

/**
 * Generate a unique ID for a new raster change
 */
export function generateChangeId(): string {
  return `raster-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * @deprecated Use generateChangeId instead
 */
export const generateRangeId = generateChangeId

/**
 * Action atom to add a new raster change
 */
export const addRasterChangeAtom = atom(
  null,
  (get, set, change: Omit<RasterChange, 'id'>) => {
    const changes = get(rasterChangesAtom)
    const newChange: RasterChange = {
      ...change,
      id: generateChangeId()
    }
    set(rasterChangesAtom, [...changes, newChange])
    return newChange.id
  }
)

/**
 * @deprecated Use addRasterChangeAtom instead
 */
export const addRasterRangeAtom = addRasterChangeAtom

/**
 * Action atom to update an existing raster change
 */
export const updateRasterChangeAtom = atom(
  null,
  (get, set, update: { id: string } & Partial<Omit<RasterChange, 'id'>>) => {
    const changes = get(rasterChangesAtom)
    const index = changes.findIndex((c) => c.id === update.id)
    if (index === -1) return false

    const updatedChanges = [...changes]
    updatedChanges[index] = { ...updatedChanges[index], ...update }
    set(rasterChangesAtom, updatedChanges)
    return true
  }
)

/**
 * @deprecated Use updateRasterChangeAtom instead
 */
export const updateRasterRangeAtom = updateRasterChangeAtom

/**
 * Action atom to remove a raster change by ID
 */
export const removeRasterChangeAtom = atom(null, (get, set, id: string) => {
  const changes = get(rasterChangesAtom)
  set(
    rasterChangesAtom,
    changes.filter((c) => c.id !== id)
  )
})

/**
 * @deprecated Use removeRasterChangeAtom instead
 */
export const removeRasterRangeAtom = removeRasterChangeAtom

/**
 * Action atom to clear all raster changes
 */
export const clearRasterChangesAtom = atom(null, (_get, set) => {
  set(rasterChangesAtom, [])
})

/**
 * @deprecated Use clearRasterChangesAtom instead
 */
export const clearRasterRangesAtom = clearRasterChangesAtom

/**
 * Derived atom: check for conflicts
 * - Same ink modified twice on same line = always a conflict
 * - Too many changes on same line = conflict
 *   - CPC Plus Mode 1 allows 4 changes per line
 *   - All other modes allow only 1 change per line
 * Returns array of conflicting change IDs
 */
export const rasterConflictsAtom = atom((get) => {
  const changes = get(rasterChangesAtom)
  const hardware = get(cpcHardwareAtom)
  const modeConfig = get(effectiveModeConfigAtom)

  // Only CPC Plus + Mode 1 (4 colors) allows 4 ink changes per line
  const isPlusMode1 = hardware === 'plus' && modeConfig.nColors === 4
  const maxChangesPerLine = isPlusMode1
    ? MAX_CHANGES_PER_LINE_PLUS_MODE1
    : MAX_CHANGES_PER_LINE_DEFAULT
  const conflicts: string[] = []

  // Group by line
  const byLine = new Map<number, RasterChange[]>()
  for (const change of changes) {
    const existing = byLine.get(change.line) || []
    existing.push(change)
    byLine.set(change.line, existing)
  }

  // Check conflicts for each line
  for (const [, lineChanges] of byLine) {
    // Check for same ink modified twice on same line
    const inksSeen = new Map<number, string>()
    for (const change of lineChanges) {
      if (inksSeen.has(change.inkIndex)) {
        // Conflict: same ink modified twice on same line
        const existingId = inksSeen.get(change.inkIndex)!
        if (!conflicts.includes(existingId)) conflicts.push(existingId)
        if (!conflicts.includes(change.id)) conflicts.push(change.id)
      } else {
        inksSeen.set(change.inkIndex, change.id)
      }
    }

    // Check for too many changes on same line
    if (lineChanges.length > maxChangesPerLine) {
      // All changes on this line are in conflict (exceeds hardware limit)
      for (const change of lineChanges) {
        if (!conflicts.includes(change.id)) conflicts.push(change.id)
      }
    }
  }

  return conflicts
})

/**
 * Derived atom: raster preview image
 * Returns an ImageData with raster effects applied, or null if rasters are disabled
 */
export const rasterPreviewImageAtom = atom(async (get) => {
  const enabled = get(rasterEnabledAtom)
  const changes = get(rasterChangesAtom)

  if (!enabled || changes.length === 0) {
    return null
  }

  const indexBufferData = await get(previewIndexBufferAtom)
  if (!indexBufferData) {
    return null
  }

  const { buffer, width, height, palette } = indexBufferData

  return createRasterPreviewImageData(buffer, width, height, palette, changes)
})

/**
 * Effective preview image atom: returns raster preview when enabled, otherwise normal preview
 */
export const effectivePreviewImageAtom = atom(async (get) => {
  const rasterPreview = await get(rasterPreviewImageAtom)
  if (rasterPreview) {
    return rasterPreview
  }

  return await get(previewImageAtom)
})
