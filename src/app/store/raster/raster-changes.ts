/**
 * Raster Changes Management
 *
 * CRUD operations and conflict detection for raster changes.
 * Each raster change modifies one ink color for a specific line.
 */

import { atom } from 'jotai'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { rasterChangesAtom, rasterMaxChangesPerLineAtom } from './raster-config'
import { rasterOptimizationResultAtom } from './raster-index-buffer'

/**
 * Action atom to clear all raster changes
 */
export const clearRasterChangesAtom = atom(null, (_get, set) => {
  set(rasterChangesAtom, [])
  set(rasterOptimizationResultAtom, null)
})

/**
 * Generate a unique ID for a new raster change
 */
export function generateChangeId(): string {
  return `raster-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

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
 * Action atom to remove a raster change by ID
 */
export const removeRasterChangeAtom = atom(null, (get, set, id: string) => {
  const changes = get(rasterChangesAtom)
  set(
    rasterChangesAtom,
    changes.filter((c) => c.id !== id)
  )
})

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Helper to check for duplicate ink changes on a line
 */
function findDuplicateInkConflicts(
  lineChanges: RasterChange[],
  conflicts: string[]
): void {
  const inksSeen = new Map<number, string>()
  for (const change of lineChanges) {
    const existingId = inksSeen.get(change.inkIndex)
    if (existingId) {
      if (!conflicts.includes(existingId)) conflicts.push(existingId)
      if (!conflicts.includes(change.id)) conflicts.push(change.id)
    } else {
      inksSeen.set(change.inkIndex, change.id)
    }
  }
}

/**
 * Helper to check if a line exceeds max changes limit
 */
function findExcessChangesConflicts(
  lineChanges: RasterChange[],
  maxChangesPerLine: number,
  conflicts: string[]
): void {
  if (lineChanges.length > maxChangesPerLine) {
    for (const change of lineChanges) {
      if (!conflicts.includes(change.id)) conflicts.push(change.id)
    }
  }
}

/**
 * Helper to group changes by line number
 */
function groupChangesByLine(
  changes: RasterChange[]
): Map<number, RasterChange[]> {
  const byLine = new Map<number, RasterChange[]>()
  for (const change of changes) {
    const existing = byLine.get(change.line) || []
    existing.push(change)
    byLine.set(change.line, existing)
  }
  return byLine
}

/**
 * Derived atom: check for conflicts
 * - Same ink modified twice on same line = always a conflict
 * - Too many changes on same line = conflict based on user setting
 * Returns array of conflicting change IDs
 */
export const rasterConflictsAtom = atom((get) => {
  const changes = get(rasterChangesAtom)
  const maxChangesPerLine = get(rasterMaxChangesPerLineAtom)
  const conflicts: string[] = []

  const byLine = groupChangesByLine(changes)

  for (const [, lineChanges] of byLine) {
    findDuplicateInkConflicts(lineChanges, conflicts)
    findExcessChangesConflicts(lineChanges, maxChangesPerLine, conflicts)
  }

  return conflicts
})
