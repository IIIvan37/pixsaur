import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { createRasterPreviewImageData } from '@/libs/pixsaur-raster'
import type { RasterRange } from '@/libs/pixsaur-raster/types'
import { previewImageAtom, previewIndexBufferAtom } from '../preview/preview'

/**
 * Whether raster mode is enabled
 */
export const rasterEnabledAtom = atomWithStorage<boolean>(
  'pixsaur-raster-enabled',
  false
)

/**
 * User-defined raster ranges
 */
export const rasterRangesAtom = atomWithStorage<RasterRange[]>(
  'pixsaur-raster-ranges',
  []
)

/**
 * Generate a unique ID for a new raster range
 */
export function generateRangeId(): string {
  return `raster-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Action atom to add a new raster range
 */
export const addRasterRangeAtom = atom(
  null,
  (get, set, range: Omit<RasterRange, 'id'>) => {
    const ranges = get(rasterRangesAtom)
    const newRange: RasterRange = {
      ...range,
      id: generateRangeId()
    }
    set(rasterRangesAtom, [...ranges, newRange])
    return newRange.id
  }
)

/**
 * Action atom to update an existing raster range
 */
export const updateRasterRangeAtom = atom(
  null,
  (get, set, update: { id: string } & Partial<Omit<RasterRange, 'id'>>) => {
    const ranges = get(rasterRangesAtom)
    const index = ranges.findIndex((r) => r.id === update.id)
    if (index === -1) return false

    const updatedRanges = [...ranges]
    updatedRanges[index] = { ...updatedRanges[index], ...update }
    set(rasterRangesAtom, updatedRanges)
    return true
  }
)

/**
 * Action atom to remove a raster range by ID
 */
export const removeRasterRangeAtom = atom(null, (get, set, id: string) => {
  const ranges = get(rasterRangesAtom)
  set(
    rasterRangesAtom,
    ranges.filter((r) => r.id !== id)
  )
})

/**
 * Action atom to clear all raster ranges
 */
export const clearRasterRangesAtom = atom(null, (_get, set) => {
  set(rasterRangesAtom, [])
})

/**
 * Derived atom: check if any ranges overlap (regardless of ink)
 * Returns array of conflicting range IDs
 */
export const rasterConflictsAtom = atom((get) => {
  const ranges = get(rasterRangesAtom)
  const conflicts: string[] = []

  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i]
      const b = ranges[j]

      // Check if overlapping lines (regardless of ink)
      const overlaps = !(a.endLine < b.startLine || b.endLine < a.startLine)
      if (overlaps) {
        if (!conflicts.includes(a.id)) conflicts.push(a.id)
        if (!conflicts.includes(b.id)) conflicts.push(b.id)
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
  const ranges = get(rasterRangesAtom)

  if (!enabled || ranges.length === 0) {
    return null
  }

  const indexBufferData = await get(previewIndexBufferAtom)
  if (!indexBufferData) {
    return null
  }

  const { buffer, width, height, palette } = indexBufferData

  return createRasterPreviewImageData(buffer, width, height, palette, ranges)
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
